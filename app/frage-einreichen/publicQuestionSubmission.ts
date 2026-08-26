export const PUBLIC_QUESTION_LIMITS = {
  question: 300,
  answer: 200,
  explanation: 500,
  sourceUrl: 1_000,
  submitterName: 120,
  submitterEmail: 254,
  submissionsPerHour: 3,
} as const;

export type PublicQuestionSubmissionInput = {
  question: string;
  answer: string;
  explanation: string;
  sourceUrl: string;
  submitterName: string;
  submitterEmail: string;
  website: string;
};

export type PublicQuestionSubmissionField =
  | "question"
  | "answer"
  | "explanation"
  | "sourceUrl"
  | "submitterName"
  | "submitterEmail";

export type PublicQuestionSubmissionState = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  fieldErrors: Partial<Record<PublicQuestionSubmissionField, string>>;
};

export const INITIAL_PUBLIC_QUESTION_SUBMISSION_STATE: PublicQuestionSubmissionState = {
  status: "IDLE",
  message: "",
  fieldErrors: {},
};

export type ValidPublicQuestionSubmission = Omit<
  PublicQuestionSubmissionInput,
  "website"
>;

export type PublicQuestionSubmissionRepository = {
  consumeRateLimit(input: {
    fingerprint: string;
    now: Date;
    maximum: number;
  }): Promise<boolean>;
  createPendingQuestion(
    input: ValidPublicQuestionSubmission,
    now: Date,
  ): Promise<number>;
};

function normalizeText(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function hasUnsafeControlCharacter(value: string) {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

function validateOptionalUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function validateOptionalEmail(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validatePublicQuestionSubmission(
  raw: PublicQuestionSubmissionInput,
):
  | { ok: true; value: ValidPublicQuestionSubmission; honeypot: boolean }
  | {
      ok: false;
      fieldErrors: Partial<Record<PublicQuestionSubmissionField, string>>;
    } {
  const value: ValidPublicQuestionSubmission = {
    question: normalizeText(raw.question),
    answer: normalizeText(raw.answer),
    explanation: normalizeText(raw.explanation),
    sourceUrl: normalizeText(raw.sourceUrl),
    submitterName: normalizeText(raw.submitterName),
    submitterEmail: normalizeText(raw.submitterEmail).toLocaleLowerCase("de-DE"),
  };
  const honeypot = normalizeText(raw.website).length > 0;
  const fieldErrors: Partial<Record<PublicQuestionSubmissionField, string>> = {};

  if (!value.question) fieldErrors.question = "Bitte gib eine Frage ein.";
  else if (value.question.length > PUBLIC_QUESTION_LIMITS.question) {
    fieldErrors.question = `Die Frage darf höchstens ${PUBLIC_QUESTION_LIMITS.question} Zeichen lang sein.`;
  }

  if (!value.answer) fieldErrors.answer = "Bitte gib die richtige Antwort ein.";
  else if (value.answer.length > PUBLIC_QUESTION_LIMITS.answer) {
    fieldErrors.answer = `Die Antwort darf höchstens ${PUBLIC_QUESTION_LIMITS.answer} Zeichen lang sein.`;
  }

  if (value.explanation.length > PUBLIC_QUESTION_LIMITS.explanation) {
    fieldErrors.explanation = `Die Erklärung darf höchstens ${PUBLIC_QUESTION_LIMITS.explanation} Zeichen lang sein.`;
  }
  if (value.sourceUrl.length > PUBLIC_QUESTION_LIMITS.sourceUrl) {
    fieldErrors.sourceUrl = `Der Quellenlink darf höchstens ${PUBLIC_QUESTION_LIMITS.sourceUrl} Zeichen lang sein.`;
  } else if (!validateOptionalUrl(value.sourceUrl)) {
    fieldErrors.sourceUrl = "Bitte verwende einen vollständigen http- oder https-Link.";
  }
  if (value.submitterName.length > PUBLIC_QUESTION_LIMITS.submitterName) {
    fieldErrors.submitterName = `Der Name darf höchstens ${PUBLIC_QUESTION_LIMITS.submitterName} Zeichen lang sein.`;
  }
  if (value.submitterEmail.length > PUBLIC_QUESTION_LIMITS.submitterEmail) {
    fieldErrors.submitterEmail = `Die E-Mail-Adresse darf höchstens ${PUBLIC_QUESTION_LIMITS.submitterEmail} Zeichen lang sein.`;
  } else if (!validateOptionalEmail(value.submitterEmail)) {
    fieldErrors.submitterEmail = "Bitte prüfe die E-Mail-Adresse.";
  }

  for (const [field, text] of Object.entries(value) as Array<
    [PublicQuestionSubmissionField, string]
  >) {
    if (hasUnsafeControlCharacter(text)) {
      fieldErrors[field] = "Dieses Feld enthält nicht unterstützte Steuerzeichen.";
    }
  }

  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, value, honeypot };
}

export async function submitPublicQuestion(
  raw: PublicQuestionSubmissionInput,
  context: { fingerprint: string; now: Date },
  repository: PublicQuestionSubmissionRepository,
): Promise<PublicQuestionSubmissionState> {
  const validation = validatePublicQuestionSubmission(raw);
  if (!validation.ok) {
    return {
      status: "ERROR",
      message: "Bitte prüfe die markierten Felder.",
      fieldErrors: validation.fieldErrors,
    };
  }

  // Bots receive the same neutral success response without creating data.
  if (validation.honeypot) {
    return {
      status: "SUCCESS",
      message: "Danke! Deine Frage ist bei uns angekommen.",
      fieldErrors: {},
    };
  }

  const accepted = await repository.consumeRateLimit({
    fingerprint: context.fingerprint,
    now: context.now,
    maximum: PUBLIC_QUESTION_LIMITS.submissionsPerHour,
  });
  if (!accepted) {
    return {
      status: "ERROR",
      message: "Du hast gerade mehrere Fragen eingereicht. Bitte versuche es in einer Stunde erneut.",
      fieldErrors: {},
    };
  }

  await repository.createPendingQuestion(validation.value, context.now);
  return {
    status: "SUCCESS",
    message: "Danke! Deine Frage wartet jetzt auf unsere redaktionelle Prüfung.",
    fieldErrors: {},
  };
}
