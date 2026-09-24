import type {
  ExternalQuestion,
  ExternalQuestionAutomationAdapter,
  ExternalQuestionAutomationResult,
  ExternalQuestionVerificationSource,
} from "./types";

export const OPENTDB_AUTOMATION_MODEL = "perplexity/sonar" as const;
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MAX_ATTEMPTS = 3;

type GatewaySearchResult = {
  title?: unknown;
  url?: unknown;
};

type GatewayResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
  citations?: unknown;
  search_results?: unknown;
};

type AutomationPayload = {
  localizedQuestion: string;
  localizedCorrectAnswer: string;
  localizedIncorrectAnswers: string[];
  explanation: string;
  suggestedCategoryName: string;
  localizationStatus: "LOCALIZED" | "REVIEW_REQUIRED";
  localizationNote: string;
  verificationStatus: "VERIFIED" | "CONTRADICTED" | "AMBIGUOUS" | "NO_RELIABLE_SOURCE";
  verificationNote: string;
  sourceUrls: string[];
  flags: {
    ambiguous: boolean;
    languageDependent: boolean;
    localContext: boolean;
    poorDistractor: boolean;
    sourceQualityLow: boolean;
    timeSensitive: boolean;
  };
  changes: string[];
  qualityNotes: string[];
  rejectRecommended: boolean;
  rejectionReason: string;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    localizedQuestion: { type: "string" },
    localizedCorrectAnswer: { type: "string" },
    localizedIncorrectAnswers: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    explanation: { type: "string" },
    suggestedCategoryName: { type: "string" },
    localizationStatus: {
      type: "string",
      enum: ["LOCALIZED", "REVIEW_REQUIRED"],
    },
    localizationNote: { type: "string" },
    verificationStatus: {
      type: "string",
      enum: ["VERIFIED", "CONTRADICTED", "AMBIGUOUS", "NO_RELIABLE_SOURCE"],
    },
    verificationNote: { type: "string" },
    sourceUrls: { type: "array", items: { type: "string" }, maxItems: 8 },
    flags: {
      type: "object",
      additionalProperties: false,
      properties: {
        ambiguous: { type: "boolean" },
        languageDependent: { type: "boolean" },
        localContext: { type: "boolean" },
        poorDistractor: { type: "boolean" },
        sourceQualityLow: { type: "boolean" },
        timeSensitive: { type: "boolean" },
      },
      required: [
        "ambiguous",
        "languageDependent",
        "localContext",
        "poorDistractor",
        "sourceQualityLow",
        "timeSensitive",
      ],
    },
    changes: { type: "array", items: { type: "string" }, maxItems: 20 },
    qualityNotes: { type: "array", items: { type: "string" }, maxItems: 12 },
    rejectRecommended: { type: "boolean" },
    rejectionReason: { type: "string" },
  },
  required: [
    "localizedQuestion",
    "localizedCorrectAnswer",
    "localizedIncorrectAnswers",
    "explanation",
    "suggestedCategoryName",
    "localizationStatus",
    "localizationNote",
    "verificationStatus",
    "verificationNote",
    "sourceUrls",
    "flags",
    "changes",
    "qualityNotes",
    "rejectRecommended",
    "rejectionReason",
  ],
} as const;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function trimmedString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeComparable(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("de").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function sourceKey(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.hostname.toLocaleLowerCase("en")}${path}`;
  } catch {
    return null;
  }
}

function isQuizSource(url: string) {
  const hostname = new URL(url).hostname.toLocaleLowerCase("en");
  return hostname.includes("opentdb.com") || /(^|\.)(quiz|trivia|sporcle)\./.test(hostname);
}

function isLowQualitySource(url: string) {
  const hostname = new URL(url).hostname.toLocaleLowerCase("en");
  return hostname.endsWith("wikipedia.org") || hostname.endsWith("fandom.com") || hostname.endsWith("reddit.com");
}

function sourcePriority(url: string) {
  const hostname = new URL(url).hostname.toLocaleLowerCase("en");
  if (
    /(^|\.)gov(\.|$)/.test(hostname) ||
    /(^|\.)edu(\.|$)/.test(hostname) ||
    hostname.endsWith(".int") ||
    hostname.endsWith("europa.eu") ||
    /(museum|university|universitaet|universität)/.test(hostname)
  ) {
    return 0;
  }
  if (hostname.endsWith("britannica.com") || hostname.endsWith("nationalgeographic.com")) return 1;
  return isLowQualitySource(url) ? 3 : 2;
}

function providerSources(response: GatewayResponse): ExternalQuestionVerificationSource[] {
  const sources: ExternalQuestionVerificationSource[] = [];
  if (Array.isArray(response.search_results)) {
    for (const entry of response.search_results as GatewaySearchResult[]) {
      const url = typeof entry?.url === "string" ? entry.url.trim() : "";
      const key = sourceKey(url);
      if (!key || isQuizSource(url)) continue;
      sources.push({
        title: trimmedString(entry.title, 300) || new URL(url).hostname,
        url,
      });
    }
  }
  if (Array.isArray(response.citations)) {
    for (const entry of response.citations) {
      const url = typeof entry === "string" ? entry.trim() : "";
      const key = sourceKey(url);
      if (!key || isQuizSource(url)) continue;
      sources.push({ title: new URL(url).hostname, url });
    }
  }
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = sourceKey(source.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parsePayload(value: unknown): AutomationPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("OPENTDB_AUTOMATION_OUTPUT_INVALID");
  }
  const input = value as Record<string, unknown>;
  const flags = input.flags;
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) {
    throw new Error("OPENTDB_AUTOMATION_FLAGS_INVALID");
  }
  const flagInput = flags as Record<string, unknown>;
  const flagNames = [
    "ambiguous",
    "languageDependent",
    "localContext",
    "poorDistractor",
    "sourceQualityLow",
    "timeSensitive",
  ] as const;
  if (flagNames.some((name) => typeof flagInput[name] !== "boolean")) {
    throw new Error("OPENTDB_AUTOMATION_FLAGS_INVALID");
  }
  if (!Array.isArray(input.localizedIncorrectAnswers) || input.localizedIncorrectAnswers.length !== 3) {
    throw new Error("OPENTDB_AUTOMATION_ANSWERS_INVALID");
  }
  const localizedIncorrectAnswers = input.localizedIncorrectAnswers.map((answer) => trimmedString(answer, 200));
  const localizedQuestion = trimmedString(input.localizedQuestion, 300);
  const localizedCorrectAnswer = trimmedString(input.localizedCorrectAnswer, 200);
  const answers = [localizedCorrectAnswer, ...localizedIncorrectAnswers];
  if (!localizedQuestion || answers.some((answer) => !answer)) {
    throw new Error("OPENTDB_AUTOMATION_CONTENT_EMPTY");
  }
  if (new Set(answers.map(normalizeComparable)).size !== 4) {
    throw new Error("OPENTDB_AUTOMATION_ANSWERS_NOT_UNIQUE");
  }
  const localizationStatus = input.localizationStatus;
  const verificationStatus = input.verificationStatus;
  if (localizationStatus !== "LOCALIZED" && localizationStatus !== "REVIEW_REQUIRED") {
    throw new Error("OPENTDB_AUTOMATION_LOCALIZATION_STATUS_INVALID");
  }
  if (!["VERIFIED", "CONTRADICTED", "AMBIGUOUS", "NO_RELIABLE_SOURCE"].includes(String(verificationStatus))) {
    throw new Error("OPENTDB_AUTOMATION_VERIFICATION_STATUS_INVALID");
  }
  if (!Array.isArray(input.sourceUrls) || !Array.isArray(input.changes) || !Array.isArray(input.qualityNotes)) {
    throw new Error("OPENTDB_AUTOMATION_METADATA_INVALID");
  }
  return {
    localizedQuestion,
    localizedCorrectAnswer,
    localizedIncorrectAnswers,
    explanation: trimmedString(input.explanation, 500),
    suggestedCategoryName: trimmedString(input.suggestedCategoryName, 100),
    localizationStatus,
    localizationNote: trimmedString(input.localizationNote, 1000),
    verificationStatus: verificationStatus as AutomationPayload["verificationStatus"],
    verificationNote: trimmedString(input.verificationNote, 1000),
    sourceUrls: input.sourceUrls.flatMap((entry) => typeof entry === "string" ? [entry.trim()] : []).slice(0, 8),
    flags: Object.fromEntries(flagNames.map((name) => [name, flagInput[name]])) as AutomationPayload["flags"],
    changes: input.changes.flatMap((entry) => typeof entry === "string" ? [entry.trim().slice(0, 300)] : []).filter(Boolean).slice(0, 20),
    qualityNotes: input.qualityNotes.flatMap((entry) => typeof entry === "string" ? [entry.trim().slice(0, 300)] : []).filter(Boolean).slice(0, 12),
    rejectRecommended: input.rejectRecommended === true,
    rejectionReason: trimmedString(input.rejectionReason, 1000),
  };
}

export function validateGatewayAutomationResponse(
  response: GatewayResponse,
  availableCategories: readonly string[],
): ExternalQuestionAutomationResult {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OPENTDB_AUTOMATION_RESPONSE_EMPTY");
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("OPENTDB_AUTOMATION_JSON_INVALID");
  }
  const payload = parsePayload(raw);
  const citedSources = providerSources(response);
  const citedByKey = new Map(citedSources.map((source) => [sourceKey(source.url), source]));
  const requestedSourceKeys = new Set(payload.sourceUrls.map(sourceKey).filter(Boolean));
  const verificationSources = citedSources.filter((source) => requestedSourceKeys.has(sourceKey(source.url)));
  const reliableSources = verificationSources.filter((source) => !isLowQualitySource(source.url));
  const requestedCategory = availableCategories.find(
    (category) => normalizeComparable(category) === normalizeComparable(payload.suggestedCategoryName),
  ) ?? null;
  let verificationStatus = payload.verificationStatus;
  if (verificationStatus === "VERIFIED" && reliableSources.length === 0) {
    verificationStatus = "NO_RELIABLE_SOURCE";
  }
  const selectedSources = verificationSources
    .map((source) => citedByKey.get(sourceKey(source.url)) ?? source)
    .sort((left, right) => sourcePriority(left.url) - sourcePriority(right.url));
  const primarySource = selectedSources[0] ?? null;
  return {
    enrichment: {
      question: payload.localizedQuestion,
      correctAnswer: payload.localizedCorrectAnswer,
      incorrectAnswers: payload.localizedIncorrectAnswers,
      explanation: payload.explanation || null,
      verificationSourceUrl: primarySource?.url ?? null,
      verificationSourceTitle: primarySource?.title ?? null,
      suggestedCategoryName: requestedCategory,
    },
    localizationStatus: payload.localizationStatus,
    localizationNote: payload.localizationNote || null,
    verificationStatus,
    verificationNote: payload.verificationNote,
    verificationSources: selectedSources,
    flags: {
      ...payload.flags,
      sourceQualityLow:
        payload.flags.sourceQualityLow ||
        (selectedSources.length > 0 && reliableSources.length === 0),
    },
    changes: [...payload.changes, ...payload.qualityNotes.map((note) => `Prüfhinweis: ${note}`)].slice(0, 20),
    rejectRecommended: payload.rejectRecommended,
    rejectionReason: payload.rejectionReason || null,
    model: OPENTDB_AUTOMATION_MODEL,
  };
}

function prompt(question: ExternalQuestion, availableCategories: readonly string[]) {
  return JSON.stringify({
    task: "Bereite diese externe Multiple-Choice-Frage für ein allgemeines deutschsprachiges PubQuiz auf und prüfe die behauptete richtige Antwort durch aktuelle Webrecherche.",
    strictRules: [
      "Nutze OpenTDB niemals als Faktenquelle.",
      "Formuliere natürliches Deutsch statt einer Wort-für-Wort-Übersetzung.",
      "Erhalte Eigennamen und Bedeutung; füge keinen Antwort-Hinweis in die Frage ein.",
      "Prüfe alle vier Antworten. Verbessere schlechte Distraktoren nur, wenn sie sicher falsch, plausibel und auf demselben Abstraktionsniveau sind.",
      "Bevorzuge offizielle, staatliche, institutionelle, wissenschaftliche, museale oder universitäre Quellen.",
      "Quizseiten sind unzulässig. Wikipedia darf nicht die einzige Quelle für VERIFIED sein.",
      "Setze VERIFIED nur, wenn die behauptete richtige Antwort durch mindestens eine belastbare gefundene Quelle gestützt wird.",
      "Markiere Zeitabhängigkeit, lokalen Kontext, Sprachabhängigkeit und Mehrdeutigkeit ehrlich.",
      "Begründe jeden gesetzten Qualitäts-Flag in qualityNotes und nenne bei Zeitabhängigkeit einen geeigneten Bezugszeitpunkt, sofern fachlich möglich.",
      "Wenn eine sichere Lokalisierung oder Prüfung nicht möglich ist, verwende REVIEW_REQUIRED beziehungsweise NO_RELIABLE_SOURCE; erfinde nichts.",
      "Wähle suggestedCategoryName exakt aus availableCategories oder lasse es als leeren String zurück.",
      "sourceUrls darf ausschließlich tatsächlich in deiner Webrecherche verwendete HTTPS-Quellen enthalten.",
    ],
    original: {
      category: question.category,
      difficulty: question.difficulty,
      question: question.question,
      correctAnswer: question.correctAnswer,
      incorrectAnswers: question.incorrectAnswers,
    },
    availableCategories,
  });
}

export class VercelAiGatewayQuestionAutomationAdapter implements ExternalQuestionAutomationAdapter {
  readonly model = OPENTDB_AUTOMATION_MODEL;

  constructor(private readonly request: typeof fetch = fetch) {}

  async process(input: {
    question: ExternalQuestion;
    availableCategories: readonly string[];
  }): Promise<ExternalQuestionAutomationResult> {
    const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!token) throw new Error("OPENTDB_AUTOMATION_CREDENTIAL_MISSING");
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.request(GATEWAY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: "system",
                content: "Du arbeitest als vorsichtige deutschsprachige Quizredaktion. Antworte ausschließlich im vorgegebenen JSON-Schema und belege Fakten durch die integrierte Websuche.",
              },
              { role: "user", content: prompt(input.question, input.availableCategories) },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "external_question_automation",
                strict: true,
                schema: responseSchema,
              },
            },
          }),
          signal: AbortSignal.timeout(50_000),
        });
        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
            await sleep(attempt * 1_000);
            continue;
          }
          throw new Error(`OPENTDB_AUTOMATION_HTTP_${response.status}`);
        }
        return validateGatewayAutomationResponse(
          await response.json() as GatewayResponse,
          input.availableCategories,
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("OPENTDB_AUTOMATION_UNKNOWN_ERROR");
        if (attempt < MAX_ATTEMPTS && /fetch|timeout|HTTP_429|HTTP_5\d\d/i.test(lastError.message)) {
          await sleep(attempt * 1_000);
          continue;
        }
        break;
      }
    }
    throw lastError ?? new Error("OPENTDB_AUTOMATION_FAILED");
  }
}
