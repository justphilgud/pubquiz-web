import { createHash } from "node:crypto";
import type {
  ExternalQuestion,
  ExternalQuestionEnrichment,
  OpenTdbApiQuestion,
  OpenTdbDifficulty,
} from "./types";
import {
  EXTERNAL_QUESTION_PROVIDER,
  OPENTDB_LICENSE,
  OPENTDB_LICENSE_URL,
} from "./types";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  nbsp: " ",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        const point = Number.parseInt(code.slice(2), 16);
        return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
      }
      if (code.startsWith("#")) {
        const point = Number.parseInt(code.slice(1), 10);
        return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    },
  );
}

export function decodeOpenTdbText(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // A malformed provider value remains visible for review instead of
    // aborting the whole batch.
  }
  return decodeHtmlEntities(decoded)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function normalizeForExternalFingerprint(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hashParts(parts: readonly string[]) {
  return createHash("sha256").update(parts.join("\u001f"), "utf8").digest("hex");
}

function parseDifficulty(value: string): OpenTdbDifficulty | null {
  return value === "easy" || value === "medium" || value === "hard"
    ? value
    : null;
}

export function normalizeOpenTdbQuestion(
  raw: OpenTdbApiQuestion,
): ExternalQuestion | null {
  const difficulty = parseDifficulty(raw.difficulty);
  if (raw.type !== "multiple" || !difficulty) return null;

  const question = decodeOpenTdbText(raw.question);
  const correctAnswer = decodeOpenTdbText(raw.correct_answer);
  const incorrectAnswers = raw.incorrect_answers.map(decodeOpenTdbText);
  const canonicalParts = [
    question,
    correctAnswer,
    ...incorrectAnswers.slice().sort(),
  ].map(normalizeForExternalFingerprint);
  const contentFingerprint = hashParts(canonicalParts);

  return {
    provider: EXTERNAL_QUESTION_PROVIDER,
    externalReference: `sha256:${contentFingerprint}`,
    license: OPENTDB_LICENSE,
    licenseUrl: OPENTDB_LICENSE_URL,
    originalLanguage: "en",
    category: decodeOpenTdbText(raw.category),
    difficulty,
    type: "multiple",
    question,
    correctAnswer,
    incorrectAnswers,
    providerPayload: raw,
    contentFingerprint,
  };
}

export function validateExternalQuestionEnrichment(
  value: unknown,
): ExternalQuestionEnrichment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.question !== "string" ||
    typeof input.correctAnswer !== "string" ||
    !Array.isArray(input.incorrectAnswers) ||
    input.incorrectAnswers.length !== 3 ||
    !input.incorrectAnswers.every((answer) => typeof answer === "string") ||
    (input.explanation !== null && typeof input.explanation !== "string") ||
    (input.verificationSourceUrl !== null && typeof input.verificationSourceUrl !== "string") ||
    (input.verificationSourceTitle !== null && typeof input.verificationSourceTitle !== "string") ||
    (input.suggestedCategoryName !== null && typeof input.suggestedCategoryName !== "string")
  ) {
    return null;
  }

  const question = input.question.trim();
  const correctAnswer = input.correctAnswer.trim();
  const incorrectAnswers = input.incorrectAnswers.map((answer) => answer.trim());
  if (!question || !correctAnswer || incorrectAnswers.some((answer) => !answer)) return null;

  const verificationSourceUrl = input.verificationSourceUrl?.trim() || null;
  if (verificationSourceUrl) {
    try {
      const url = new URL(verificationSourceUrl);
      if (url.protocol !== "https:") return null;
    } catch {
      return null;
    }
  }

  return {
    question,
    correctAnswer,
    incorrectAnswers,
    explanation: input.explanation?.trim() || null,
    verificationSourceUrl,
    verificationSourceTitle: input.verificationSourceTitle?.trim() || null,
    suggestedCategoryName: input.suggestedCategoryName?.trim() || null,
  };
}
