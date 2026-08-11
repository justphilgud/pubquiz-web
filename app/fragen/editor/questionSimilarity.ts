export function normalizeQuestionForSimilarity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/\u00df/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value}  `;
  return new Set(
    Array.from({ length: Math.max(0, padded.length - 2) }, (_, index) =>
      padded.slice(index, index + 3),
    ),
  );
}

export function calculateQuestionSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeQuestionForSimilarity(left);
  const normalizedRight = normalizeQuestionForSimilarity(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const leftParts = trigrams(normalizedLeft);
  const rightParts = trigrams(normalizedRight);
  const intersection = [...leftParts].filter((part) => rightParts.has(part)).length;
  return (2 * intersection) / (leftParts.size + rightParts.size);
}

export function isPotentialQuestionDuplicate(left: string, right: string) {
  return calculateQuestionSimilarity(left, right) >= 0.58;
}

function normalizedParts(values: readonly string[]) {
  return values
    .map(normalizeQuestionForSimilarity)
    .filter(Boolean);
}

export function getQuestionDuplicateFingerprint(
  input: QuestionDuplicateInput,
): string {
  const data = parseQuestionTemplateData(
    input.templateConfig?.templateData,
    input.templateId,
    false,
  );
  const correctAnswers = normalizedParts(
    input.answers
      .filter((answer) => answer.isCorrect !== false)
      .map((answer) => answer.text),
  );
  const definition = getQuestionTemplateDefinition(input.templateId);
  const question = definition?.questionTextIsTemplateStatic
    ? ""
    : normalizeQuestionForSimilarity(input.questionText);

  if (data?.kind === "TRANSLATION_READ_ALOUD") {
    return ["translation", ...normalizedParts([data.originalText]), ...correctAnswers]
      .join(" ");
  }
  if (data?.kind === "GOOGLE_REVIEWS") {
    return [
      "google reviews",
      normalizeQuestionForSimilarity(
        data.placeName || data.placeMapsUrl || data.placeId,
      ),
      ...normalizedParts(data.reviews.flatMap((review) => [
        review.text,
        review.sourceUrl,
      ])).sort(),
    ].filter(Boolean).join(" ");
  }
  if (data?.kind === "ANAGRAM") {
    return ["anagram", normalizeQuestionForSimilarity(data.name)].join(" ");
  }
  if (data?.kind === "ESTIMATE") {
    return [
      "estimate",
      question,
      String(data.correctValue ?? ""),
      normalizeQuestionForSimilarity(data.unit),
    ].filter(Boolean).join(" ");
  }
  if (data?.kind === "ORDERING") {
    return [
      "ordering",
      question,
      ...normalizedParts(data.items.map((item) => item.text)).sort(),
    ].join(" ");
  }
  if (data?.kind === "TRUE_FALSE") {
    return ["true false", question].join(" ");
  }
  if (definition?.questionTextIsTemplateStatic) {
    return [definition.id, ...correctAnswers].filter(Boolean).join(" ");
  }
  return question;
}
import type { QuestionTemplateConfig } from "./types";
import { parseQuestionTemplateData } from "./templates/questionTemplateData";
import { getQuestionTemplateDefinition } from "./templates/questionTemplates";

export type QuestionDuplicateInput = {
  questionText: string;
  templateId: string | null;
  templateConfig: QuestionTemplateConfig | null;
  answers: readonly {
    text: string;
    isCorrect?: boolean;
    additionalInfo?: string;
  }[];
};
