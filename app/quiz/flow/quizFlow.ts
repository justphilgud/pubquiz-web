import { isSafeTemplateAssetReference } from "@/app/rendering/presentationTemplates/presentationTemplateAssets";

export const QUIZ_FLOW_ITEM_TYPES = [
  "WAITING",
  "START_SEQUENCE",
  "WELCOME",
  "PRIZES",
  "QR_CODE",
  "RULES",
  "ROUND_INTRO",
  "BREAK",
  "COUNTDOWN",
  "INTERMEDIATE_STANDINGS",
  "FINAL_STANDINGS",
  "WINNER",
  "CUSTOM_MESSAGE",
  "CLOSING",
  "QUESTION",
  "QUESTION_SOLUTION",
  "CHAPTER_INTRO",
  "IMAGE",
  "IMAGE_GALLERY",
  "TEXT",
  "ANECDOTE",
  "QUOTE",
  "PORTRAIT",
  "MEDIA_SEQUENCE",
  "AUDIO",
  "VIDEO",
] as const;

export type QuizFlowItemType = (typeof QUIZ_FLOW_ITEM_TYPES)[number];

export const QUIZ_FLOW_ANCHOR_TYPES = [
  "BEFORE_QUIZ",
  "ROUND_START",
  "ROUND_END",
  "AFTER_QUIZ",
  "BLOCK",
] as const;

export type QuizFlowAnchorType = (typeof QUIZ_FLOW_ANCHOR_TYPES)[number];

export type QuizFlowRule = {
  id: string;
  text: string;
  enabled: boolean;
};

export const QUIZ_SOLUTION_STRATEGIES = [
  "AFTER_EACH_QUESTION",
  "END_OF_BLOCK",
  "MANUAL",
] as const;

export const QUIZ_STANDARD_SOLUTION_STRATEGIES = [
  "AFTER_EACH_QUESTION",
  "END_OF_BLOCK",
] as const satisfies readonly QuizSolutionStrategy[];

export type QuizSolutionStrategy =
  (typeof QUIZ_SOLUTION_STRATEGIES)[number];

export const DEFAULT_NEW_QUIZ_SOLUTION_STRATEGY: QuizSolutionStrategy =
  "END_OF_BLOCK";

export const QUIZ_GLOBAL_FLOW_ITEM_TYPES = [
  "WAITING",
  "START_SEQUENCE",
  "WELCOME",
  "PRIZES",
  "QR_CODE",
  "RULES",
  "ROUND_INTRO",
  "BREAK",
  "COUNTDOWN",
  "INTERMEDIATE_STANDINGS",
  "FINAL_STANDINGS",
  "WINNER",
  "CUSTOM_MESSAGE",
  "CLOSING",
] as const satisfies readonly QuizFlowItemType[];

export const QUIZ_BLOCK_FLOW_ITEM_TYPES = [
  "CHAPTER_INTRO",
  "IMAGE",
  "IMAGE_GALLERY",
  "TEXT",
  "ANECDOTE",
  "QUOTE",
  "PORTRAIT",
  "MEDIA_SEQUENCE",
  "AUDIO",
  "VIDEO",
  "CUSTOM_MESSAGE",
  "INTERMEDIATE_STANDINGS",
] as const satisfies readonly QuizFlowItemType[];

export type QuizFlowImage = {
  id: string;
  url: string;
  altText: string;
  caption?: string;
};

export type QuizFlowConfig = {
  version: 1;
  title?: string;
  subtitle?: string;
  body?: string;
  moderatorNote?: string;
  imageUrl?: string;
  teamHint?: string;
  contact?: string;
  rules?: QuizFlowRule[];
  durationSeconds?: number;
  showCountdown?: boolean;
  standingsSize?: "TOP_3" | "TOP_5" | "ALL" | "HIDDEN";
  showPoints?: boolean;
  altText?: string;
  caption?: string;
  quoteSource?: string;
  yearOrContext?: string;
  personName?: string;
  description?: string;
  audioUrl?: string;
  videoUrl?: string;
  posterImageUrl?: string;
  images?: QuizFlowImage[];
};

export type QuizFlowItem = {
  id: string;
  persistentId: number | null;
  type: QuizFlowItemType;
  anchorType: QuizFlowAnchorType;
  anchorKey: string;
  sectionId: number | null;
  order: number;
  enabled: boolean;
  label: string | null;
  config: QuizFlowConfig;
  configVersion: number;
  questionAssignmentId: number | null;
  storyElementId?: number | null;
  storyElementRevisionId?: number | null;
  storyQuestionAssignmentId?: number | null;
  storyRelationship?: string | null;
  isStandard: boolean;
};

export type StoredQuizFlowItem = {
  quiz_ablauf_element_id: number;
  typ: string;
  anker_typ: string;
  anker_schluessel: string;
  quiz_abschnitt_id: number | null;
  quiz_fragen_id?: number | null;
  story_element_id?: number | null;
  story_element_revision_id?: number | null;
  story_bezugs_quiz_fragen_id?: number | null;
  story_beziehung?: string | null;
  sortierung: number;
  ist_sichtbar: boolean;
  bezeichnung: string | null;
  konfiguration: unknown;
  konfigurations_version?: number;
  ist_standard: boolean;
};

type DefaultFlowQuiz = {
  titel: string | null;
  intro_begruessungstitel: string | null;
  intro_begruessungstext: string | null;
  intro_regeln: string | null;
  intro_preise: string | null;
  intro_wartetext: string | null;
  intro_video_url: string | null;
  intro_startzeit: string | null;
  intro_musik_url: string | null;
  intro_startsequenz_text?: string | null;
  outro_bekanntmachungen: string | null;
  abschnitte: {
    quiz_abschnitt_id: number;
    titel: string;
    abschnitt_typ: string;
    sortierung: number;
    dauer_sekunden: number | null;
    bemerkung: string | null;
  }[];
  fragen: {
    quiz_abschnitt_id: number | null;
  }[];
};

const DEFAULT_RULES = [
  "Teamname wählen",
  "Antworten rechtzeitig absenden",
  "Keine Suchmaschinen verwenden",
  "Die Entscheidung der Moderation gilt",
];

const TEXT_LIMITS = {
  title: 160,
  subtitle: 240,
  body: 2_000,
  moderatorNote: 2_000,
  imageUrl: 2_048,
  teamHint: 500,
  contact: 500,
  altText: 500,
  caption: 800,
  quoteSource: 240,
  yearOrContext: 240,
  personName: 160,
  description: 1_200,
  audioUrl: 2_048,
  videoUrl: 2_048,
  posterImageUrl: 2_048,
} as const;

const CONFIG_KEYS = new Set([
  "version",
  ...Object.keys(TEXT_LIMITS),
  "rules",
  "durationSeconds",
  "showCountdown",
  "standingsSize",
  "showPoints",
  "images",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isQuizFlowItemType(value: unknown): value is QuizFlowItemType {
  return (
    typeof value === "string" &&
    QUIZ_FLOW_ITEM_TYPES.some((itemType) => itemType === value)
  );
}

export function isQuizFlowAnchorType(value: unknown): value is QuizFlowAnchorType {
  return (
    typeof value === "string" &&
    QUIZ_FLOW_ANCHOR_TYPES.some((anchorType) => anchorType === value)
  );
}

export function isQuizBlockFlowItemType(
  value: unknown,
): value is (typeof QUIZ_BLOCK_FLOW_ITEM_TYPES)[number] {
  return QUIZ_BLOCK_FLOW_ITEM_TYPES.some((type) => type === value);
}

export function isQuizGlobalFlowItemType(
  value: unknown,
): value is (typeof QUIZ_GLOBAL_FLOW_ITEM_TYPES)[number] {
  return QUIZ_GLOBAL_FLOW_ITEM_TYPES.some((type) => type === value);
}

export function isQuizSolutionStrategy(
  value: unknown,
): value is QuizSolutionStrategy {
  return QUIZ_SOLUTION_STRATEGIES.some((strategy) => strategy === value);
}

export function getQuizSolutionStrategyLabel(strategy: QuizSolutionStrategy) {
  return ({
    AFTER_EACH_QUESTION: "Direkt nach jeder Frage",
    END_OF_BLOCK: "Gesammelt am Ende des Blocks",
    MANUAL: "Manuell im Ablauf",
  } as const)[strategy];
}

export function getEffectiveQuizSolutionStrategy(
  quizStrategy: unknown,
  sectionStrategy: unknown,
): QuizSolutionStrategy {
  if (isQuizSolutionStrategy(sectionStrategy)) return sectionStrategy;
  return isQuizSolutionStrategy(quizStrategy)
    ? quizStrategy
    : "AFTER_EACH_QUESTION";
}

const localMediaPattern = /^\/(?!\/)[a-zA-Z0-9%() _./-]+$/;
const managedBlobPattern =
  /^https:\/\/[a-zA-Z0-9.-]+\.blob\.vercel-storage\.com\/[a-zA-Z0-9%()_./-]+$/;

function hasAllowedExtension(value: string, extensions: readonly string[]) {
  const path = value.split(/[?#]/, 1)[0].toLowerCase();
  return extensions.some((extension) => path.endsWith(`.${extension}`));
}

export function isSafeQuizFlowMediaReference(
  value: unknown,
  kind: "IMAGE" | "AUDIO" | "VIDEO",
): value is string {
  if (
    typeof value !== "string" ||
    (!localMediaPattern.test(value) && !managedBlobPattern.test(value))
  ) {
    return false;
  }
  if (kind === "IMAGE") return isSafeTemplateAssetReference(value);
  if (kind === "AUDIO") {
    return hasAllowedExtension(value, ["mp3", "wav", "ogg", "m4a"]);
  }
  return hasAllowedExtension(value, ["mp4", "webm", "mov"]);
}

function normalizeText(
  value: unknown,
  limit: number,
): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length > limit) return null;
  return normalized || undefined;
}

export type QuizFlowConfigValidation =
  | { ok: true; value: QuizFlowConfig }
  | { ok: false; message: string };

export function validateQuizFlowConfig(
  type: QuizFlowItemType,
  input: unknown,
): QuizFlowConfigValidation {
  if (!isRecord(input) || input.version !== 1) {
    return { ok: false, message: "Die Ablaufkonfiguration benötigt Version 1." };
  }

  if (Object.keys(input).some((key) => !CONFIG_KEYS.has(key))) {
    return { ok: false, message: "Die Ablaufkonfiguration enthält unbekannte Felder." };
  }

  const result: QuizFlowConfig = { version: 1 };
  for (const [key, limit] of Object.entries(TEXT_LIMITS) as [
    keyof typeof TEXT_LIMITS,
    number,
  ][]) {
    const normalized = normalizeText(input[key], limit);
    if (normalized === null) {
      return { ok: false, message: `Das Feld ${key} ist ungültig oder zu lang.` };
    }
    if (normalized !== undefined) result[key] = normalized;
  }
  if (result.imageUrl && !isSafeTemplateAssetReference(result.imageUrl)) {
    return {
      ok: false,
      message: "Der Bildpfad muss ein erlaubtes Repository- oder verwaltetes Blob-Asset sein.",
    };
  }
  if (
    result.posterImageUrl &&
    !isSafeQuizFlowMediaReference(result.posterImageUrl, "IMAGE")
  ) {
    return {
      ok: false,
      message: "Das Posterbild muss ein erlaubtes Repository- oder verwaltetes Blob-Asset sein.",
    };
  }
  if (
    result.audioUrl &&
    !isSafeQuizFlowMediaReference(result.audioUrl, "AUDIO")
  ) {
    return {
      ok: false,
      message: "Die Audiodatei muss eine erlaubte Repository- oder verwaltete Blob-Datei sein.",
    };
  }
  if (
    result.videoUrl &&
    !isSafeQuizFlowMediaReference(result.videoUrl, "VIDEO")
  ) {
    return {
      ok: false,
      message: "Die Videodatei muss eine erlaubte Repository- oder verwaltete Blob-Datei sein.",
    };
  }

  if (input.images !== undefined) {
    if (!Array.isArray(input.images) || input.images.length > 12) {
      return { ok: false, message: "Eine Bildfolge darf höchstens zwölf Bilder enthalten." };
    }
    const images: QuizFlowImage[] = [];
    const ids = new Set<string>();
    for (const [index, image] of input.images.entries()) {
      if (!isRecord(image) || typeof image.id !== "string" || image.id.length > 80) {
        return { ok: false, message: `Bild ${index + 1} besitzt keine gültige ID.` };
      }
      const id = image.id.trim();
      const url = normalizeText(image.url, 2_048);
      const altText = normalizeText(image.altText, 500);
      const caption = normalizeText(image.caption, 800);
      if (
        !id ||
        ids.has(id) ||
        !url ||
        !altText ||
        caption === null ||
        !isSafeQuizFlowMediaReference(url, "IMAGE")
      ) {
        return { ok: false, message: `Bild ${index + 1} ist unvollständig oder ungültig.` };
      }
      ids.add(id);
      images.push({ id, url, altText, ...(caption ? { caption } : {}) });
    }
    result.images = images;
  }

  if (input.rules !== undefined) {
    if (!Array.isArray(input.rules) || input.rules.length > 12) {
      return { ok: false, message: "Es sind höchstens zwölf Regeln erlaubt." };
    }
    const rules: QuizFlowRule[] = [];
    for (const [index, rule] of input.rules.entries()) {
      if (
        !isRecord(rule) ||
        typeof rule.id !== "string" ||
        typeof rule.enabled !== "boolean"
      ) {
        return { ok: false, message: `Regel ${index + 1} ist ungültig.` };
      }
      const text = normalizeText(rule.text, 500);
      if (!text || rule.id.length > 80) {
        return { ok: false, message: `Regel ${index + 1} benötigt einen gültigen Text.` };
      }
      rules.push({ id: rule.id, text, enabled: rule.enabled });
    }
    result.rules = rules;
  }

  if (input.durationSeconds !== undefined) {
    if (
      typeof input.durationSeconds !== "number" ||
      !Number.isInteger(input.durationSeconds) ||
      input.durationSeconds < 0 ||
      input.durationSeconds > 7_200
    ) {
      return { ok: false, message: "Die Dauer muss zwischen 0 und 7200 Sekunden liegen." };
    }
    result.durationSeconds = input.durationSeconds;
  }

  for (const key of ["showCountdown", "showPoints"] as const) {
    if (input[key] !== undefined && typeof input[key] !== "boolean") {
      return { ok: false, message: `Das Feld ${key} muss ein Wahrheitswert sein.` };
    }
    if (typeof input[key] === "boolean") result[key] = input[key];
  }

  if (input.standingsSize !== undefined) {
    if (
      input.standingsSize !== "TOP_3" &&
      input.standingsSize !== "TOP_5" &&
      input.standingsSize !== "ALL" &&
      input.standingsSize !== "HIDDEN"
    ) {
      return { ok: false, message: "Die Ranglistenansicht ist ungültig." };
    }
    result.standingsSize = input.standingsSize;
  }

  if (type === "RULES" && !result.rules) {
    return { ok: false, message: "Ein Regelelement benötigt eine Regelliste." };
  }

  if (type === "IMAGE" && (!result.imageUrl || !result.altText)) {
    return { ok: false, message: "Ein Bild benötigt einen Bildpfad und einen Alt-Text." };
  }
  if (
    (type === "IMAGE_GALLERY" || type === "MEDIA_SEQUENCE") &&
    (!result.images || result.images.length < 2)
  ) {
    return { ok: false, message: "Eine Bildfolge benötigt mindestens zwei Bilder." };
  }
  if ((type === "TEXT" || type === "ANECDOTE") && !result.body) {
    return { ok: false, message: "Ein Textelement benötigt einen Text." };
  }
  if (type === "QUOTE" && !result.body) {
    return { ok: false, message: "Ein Zitat benötigt einen Zitattext." };
  }
  if (type === "PORTRAIT" && (!result.personName || !result.imageUrl || !result.altText)) {
    return { ok: false, message: "Ein Portrait benötigt Name, Bildpfad und Alt-Text." };
  }
  if (type === "CHAPTER_INTRO" && !result.title) {
    return { ok: false, message: "Ein Kapitelintro benötigt einen Titel." };
  }
  if (type === "AUDIO" && (!result.title || !result.audioUrl)) {
    return { ok: false, message: "Ein Audioelement benötigt Titel und Audiodatei." };
  }
  if (type === "VIDEO" && (!result.title || !result.videoUrl)) {
    return { ok: false, message: "Ein Videoelement benötigt Titel und Videodatei." };
  }

  return { ok: true, value: result };
}

function defaultItem(
  type: QuizFlowItemType,
  anchorType: QuizFlowAnchorType,
  anchorKey: string,
  sectionId: number | null,
  order: number,
  config: QuizFlowConfig,
  enabled = true,
): QuizFlowItem {
  return {
    id: `default:${anchorType}:${anchorKey}:${type}`,
    persistentId: null,
    type,
    anchorType,
    anchorKey,
    sectionId,
    order,
    enabled,
    label: null,
    config,
    configVersion: 1,
    questionAssignmentId: null,
    storyElementId: null,
    storyElementRevisionId: null,
    storyQuestionAssignmentId: null,
    storyRelationship: null,
    isStandard: true,
  };
}

function rulesFromText(value: string | null): QuizFlowRule[] {
  const lines = (value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return (lines.length > 0 ? lines : DEFAULT_RULES).map((text, index) => ({
    id: `rule-${index + 1}`,
    text,
    enabled: true,
  }));
}

function buildRoundDefaults(
  quiz: DefaultFlowQuiz,
  section: DefaultFlowQuiz["abschnitte"][number],
  sectionIndex: number,
  sectionCount: number,
): QuizFlowItem[] {
  const questionCount = quiz.fragen.filter(
    (question) => question.quiz_abschnitt_id === section.quiz_abschnitt_id,
  ).length;
  const roundKey = String(section.quiz_abschnitt_id);
  const items = [
    defaultItem(
      "ROUND_INTRO",
      "ROUND_START",
      roundKey,
      section.quiz_abschnitt_id,
      10,
      {
        version: 1,
        title: section.titel || `Runde ${sectionIndex + 1}`,
        subtitle: `${questionCount} ${questionCount === 1 ? "Frage" : "Fragen"}`,
        body: section.bemerkung ?? undefined,
      },
    ),
  ];

  if (questionCount > 0) {
    items.push(
      defaultItem(
        "BREAK",
        "ROUND_END",
        roundKey,
        section.quiz_abschnitt_id,
        10,
        {
          version: 1,
          title: "Kurze Pause",
          body: "Zeit zum Durchatmen und für die nächste Runde.",
          durationSeconds: section.dauer_sekunden ?? 300,
          showCountdown: true,
        },
      ),
    );
  }

  if (sectionIndex < sectionCount - 1) {
    items.push(
      defaultItem(
        "INTERMEDIATE_STANDINGS",
        "ROUND_END",
        roundKey,
        section.quiz_abschnitt_id,
        20,
        { version: 1, title: "Zwischenstand", standingsSize: "TOP_5", showPoints: true },
      ),
    );
  }

  return items;
}

function isQuestionSectionType(value: string) {
  return value === "fragenblock" || value === "fragenrunde";
}

export function buildDefaultQuizFlow(quiz: DefaultFlowQuiz): QuizFlowItem[] {
  const hasLegacyIntro = quiz.abschnitte.some(
    (section) => section.abschnitt_typ === "intro",
  );
  const hasWaitingContent = Boolean(
    quiz.intro_video_url || quiz.intro_startzeit || quiz.intro_wartetext,
  );
  const hasStartSequenceContent = Boolean(
    quiz.intro_startsequenz_text || quiz.intro_musik_url,
  );
  const result: QuizFlowItem[] = [];

  if (hasLegacyIntro || hasWaitingContent) {
    result.push(
      defaultItem("WAITING", "BEFORE_QUIZ", "QUIZ", null, 10, {
        version: 1,
        title: "Das Quiz startet in Kürze",
        body: quiz.intro_wartetext ?? undefined,
      }),
    );
  }
  if (hasLegacyIntro || hasStartSequenceContent) {
    result.push(
      defaultItem("START_SEQUENCE", "BEFORE_QUIZ", "QUIZ", null, 20, {
        version: 1,
        title: quiz.intro_startsequenz_text ?? "Gleich geht es los",
      }),
    );
  }
  result.push(
    defaultItem("WELCOME", "BEFORE_QUIZ", "QUIZ", null, 30, {
      version: 1,
      title: quiz.intro_begruessungstitel ?? quiz.titel ?? "Willkommen",
      body: quiz.intro_begruessungstext ?? "Willkommen zum heutigen Quizabend!",
    }),
  );
  if (hasLegacyIntro || quiz.intro_preise?.trim()) {
    result.push(
      defaultItem("PRIZES", "BEFORE_QUIZ", "QUIZ", null, 40, {
        version: 1,
        title: "Preise",
        body: quiz.intro_preise ?? undefined,
      }),
    );
  }
  result.push(
    defaultItem("QR_CODE", "BEFORE_QUIZ", "QUIZ", null, 50, {
      version: 1,
      title: "Jetzt mitspielen",
      body: "QR-Code scannen und Team anmelden.",
      teamHint: "Wählt einen eindeutigen Teamnamen.",
    }),
    defaultItem("RULES", "BEFORE_QUIZ", "QUIZ", null, 60, {
      version: 1,
      title: "Die Regeln",
      rules: rulesFromText(quiz.intro_regeln),
    }),
  );

  const rounds = [...quiz.abschnitte]
    .filter((section) => isQuestionSectionType(section.abschnitt_typ))
    .sort((left, right) => left.sortierung - right.sortierung);
  rounds.forEach((section, index) => {
    result.push(...buildRoundDefaults(quiz, section, index, rounds.length));
  });

  result.push(
    defaultItem("FINAL_STANDINGS", "AFTER_QUIZ", "QUIZ", null, 10, {
      version: 1,
      title: "Endstand",
      standingsSize: "ALL",
      showPoints: true,
    }),
    defaultItem("WINNER", "AFTER_QUIZ", "QUIZ", null, 20, {
      version: 1,
      title: "Herzlichen Glückwunsch",
      body: "Danke für einen großartigen Quizabend.",
      standingsSize: "TOP_3",
      showPoints: true,
    }),
    defaultItem("CLOSING", "AFTER_QUIZ", "QUIZ", null, 30, {
      version: 1,
      title: "Danke fürs Mitspielen!",
      body:
        quiz.outro_bekanntmachungen ??
        "Wir freuen uns auf den nächsten gemeinsamen Quizabend.",
    }),
  );

  return result;
}

export function parseStoredQuizFlowItem(
  item: StoredQuizFlowItem,
): QuizFlowItem | null {
  if (!isQuizFlowItemType(item.typ) || !isQuizFlowAnchorType(item.anker_typ)) {
    return null;
  }
  if (
    (item.anker_typ === "ROUND_START" || item.anker_typ === "ROUND_END") &&
    item.quiz_abschnitt_id === null
  ) {
    return null;
  }
  if (item.anker_typ === "BLOCK" && item.quiz_abschnitt_id === null) {
    return null;
  }
  const questionAssignmentId = item.quiz_fragen_id ?? null;
  const isQuestionItem =
    item.typ === "QUESTION" || item.typ === "QUESTION_SOLUTION";
  if (isQuestionItem !== (questionAssignmentId !== null)) return null;
  const configVersion = item.konfigurations_version ?? 1;
  if (configVersion !== 1) return null;
  const config = validateQuizFlowConfig(item.typ, item.konfiguration);
  if (!config.ok) return null;
  return {
    id: `flow:${item.quiz_ablauf_element_id}`,
    persistentId: item.quiz_ablauf_element_id,
    type: item.typ,
    anchorType: item.anker_typ,
    anchorKey: item.anker_schluessel,
    sectionId: item.quiz_abschnitt_id,
    order: item.sortierung,
    enabled: item.ist_sichtbar,
    label: item.bezeichnung,
    config: config.value,
    configVersion,
    questionAssignmentId,
    storyElementId: item.story_element_id ?? null,
    storyElementRevisionId: item.story_element_revision_id ?? null,
    storyQuestionAssignmentId: item.story_bezugs_quiz_fragen_id ?? null,
    storyRelationship: item.story_beziehung ?? null,
    isStandard: item.ist_standard,
  };
}

export function resolveQuizFlow(
  quiz: DefaultFlowQuiz,
  storedItems: readonly StoredQuizFlowItem[],
): QuizFlowItem[] {
  if (storedItems.length === 0) return buildDefaultQuizFlow(quiz);

  const parsed = storedItems
    .map(parseStoredQuizFlowItem)
    .filter((item): item is QuizFlowItem => item !== null);
  const defaults = buildDefaultQuizFlow(quiz);
  const representedDefaultKeys = new Set(
    parsed
      .filter((item) => item.isStandard)
      .map((item) => `${item.anchorType}:${item.anchorKey}:${item.type}`),
  );
  const missingDefaults = defaults.filter(
    (item) =>
      !representedDefaultKeys.has(
        `${item.anchorType}:${item.anchorKey}:${item.type}`,
      ),
  );

  return [...parsed, ...missingDefaults].sort(compareQuizFlowItems);
}

const ANCHOR_ORDER: Record<QuizFlowAnchorType, number> = {
  BEFORE_QUIZ: 0,
  ROUND_START: 1,
  BLOCK: 2,
  ROUND_END: 3,
  AFTER_QUIZ: 4,
};

export function compareQuizFlowItems(left: QuizFlowItem, right: QuizFlowItem) {
  const anchorDifference = ANCHOR_ORDER[left.anchorType] - ANCHOR_ORDER[right.anchorType];
  if (anchorDifference !== 0) return anchorDifference;
  if (left.sectionId !== right.sectionId) {
    return (left.sectionId ?? 0) - (right.sectionId ?? 0);
  }
  return left.order - right.order;
}

export function getQuizFlowTypeLabel(type: QuizFlowItemType) {
  return ({
    WAITING: "Wartebildschirm",
    START_SEQUENCE: "Startsequenz",
    WELCOME: "Begrüßung",
    PRIZES: "Preise",
    QR_CODE: "QR-Code",
    RULES: "Regeln",
    ROUND_INTRO: "Rundenintro",
    BREAK: "Pause",
    COUNTDOWN: "Countdown",
    INTERMEDIATE_STANDINGS: "Zwischenstand",
    FINAL_STANDINGS: "Endstand",
    WINNER: "Gewinner",
    CUSTOM_MESSAGE: "Freie Mitteilung",
    CLOSING: "Abschluss",
    QUESTION: "Frage",
    QUESTION_SOLUTION: "Auflösung",
    CHAPTER_INTRO: "Kapitelintro",
    IMAGE: "Bild",
    IMAGE_GALLERY: "Bildergalerie",
    TEXT: "Text / Anekdote",
    ANECDOTE: "Anekdote",
    QUOTE: "Zitat",
    PORTRAIT: "Portrait",
    MEDIA_SEQUENCE: "Bildsequenz",
    AUDIO: "Audio",
    VIDEO: "Video",
  } as const)[type];
}

export function getInitialQuizFlowConfig(
  type: QuizFlowItemType,
): QuizFlowConfig {
  if (type === "RULES") {
    return { version: 1, title: "Die Regeln", rules: rulesFromText(null) };
  }
  if (type === "BREAK" || type === "COUNTDOWN") {
    return {
      version: 1,
      title: type === "BREAK" ? "Kurze Pause" : "Countdown",
      durationSeconds: 300,
      showCountdown: true,
    };
  }
  if (type === "INTERMEDIATE_STANDINGS") {
    return { version: 1, title: "Zwischenstand", standingsSize: "TOP_5", showPoints: true };
  }
  if (type === "FINAL_STANDINGS") {
    return { version: 1, title: "Endstand", standingsSize: "ALL", showPoints: true };
  }
  if (type === "WINNER") {
    return { version: 1, title: "Herzlichen Glückwunsch", standingsSize: "TOP_3", showPoints: true };
  }
  if (type === "QUESTION" || type === "QUESTION_SOLUTION") {
    return { version: 1 };
  }
  if (type === "CHAPTER_INTRO") {
    return { version: 1, title: "Neues Kapitel" };
  }
  if (type === "IMAGE") {
    return { version: 1, title: "Bildmoment", imageUrl: "/medien/template-preview.svg", altText: "Redaktionelles Bild" };
  }
  if (type === "IMAGE_GALLERY" || type === "MEDIA_SEQUENCE") {
    return {
      version: 1,
      title: type === "IMAGE_GALLERY" ? "Bildergalerie" : "Bildsequenz",
      images: [
        { id: "image-1", url: "/medien/template-preview.svg", altText: "Erstes Bild" },
        { id: "image-2", url: "/medien/template-preview.svg", altText: "Zweites Bild" },
      ],
    };
  }
  if (type === "TEXT" || type === "ANECDOTE") {
    return { version: 1, title: "Anekdote", body: "Redaktionellen Text ergänzen." };
  }
  if (type === "QUOTE") {
    return { version: 1, body: "Zitat ergänzen." };
  }
  if (type === "PORTRAIT") {
    return { version: 1, personName: "Person", imageUrl: "/medien/template-preview.svg", altText: "Portrait" };
  }
  if (type === "AUDIO") {
    return { version: 1, title: "Audiomoment", audioUrl: "/medien/audio/intro/6.mp3" };
  }
  if (type === "VIDEO") {
    return { version: 1, title: "Videomoment", videoUrl: "/medien/video/intro/intro.mp4" };
  }
  return { version: 1, title: getQuizFlowTypeLabel(type) };
}

export function getQuizFlowAnswerStatus(type: QuizFlowItemType) {
  if (type === "BREAK" || type === "COUNTDOWN") return "Pause";
  if (type === "INTERMEDIATE_STANDINGS") return "Der Zwischenstand wird gezeigt";
  if (type === "ROUND_INTRO") return "Die nächste Runde beginnt gleich";
  if (type === "FINAL_STANDINGS" || type === "WINNER" || type === "CLOSING") {
    return "Das Quiz ist beendet";
  }
  if (type === "QUESTION_SOLUTION") return "Die Auflösung wird gezeigt";
  if (["CHAPTER_INTRO", "IMAGE", "IMAGE_GALLERY", "TEXT", "ANECDOTE", "QUOTE", "PORTRAIT", "MEDIA_SEQUENCE", "AUDIO", "VIDEO", "CUSTOM_MESSAGE"].includes(type)) {
    return "Bitte folgt der Präsentation";
  }
  return "Das Quiz startet gleich";
}

export function getQuizFlowTypeFromSlideKey(
  slideKey: string | null | undefined,
): QuizFlowItemType | null {
  if (!slideKey || (!slideKey.startsWith("flow:") && !slideKey.startsWith("default:"))) {
    return null;
  }
  const candidate = slideKey.split(":").at(-1);
  return isQuizFlowItemType(candidate) ? candidate : null;
}
