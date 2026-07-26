import { normalizeEvaluationText } from "./evaluationDetails";

export type AnswerContent = {
  answerText: string | null;
  selectedAnswerIds: readonly number[];
  structuredAnswers: ReadonlyArray<{
    fieldId: number;
    answerText: string | null;
  }>;
};

function normalizeAnswerText(value: string | null) {
  if (!value?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
      return JSON.stringify(parsed);
    }
  } catch {
    // Ordinary free text is not JSON.
  }
  return normalizeEvaluationText(value);
}

export function getAnswerContentFingerprint(content: AnswerContent): string {
  return JSON.stringify({
    answerText: normalizeAnswerText(content.answerText),
    selectedAnswerIds: [...new Set(content.selectedAnswerIds)].sort(
      (left, right) => left - right,
    ),
    structuredAnswers: content.structuredAnswers
      .map((field) => ({
        fieldId: field.fieldId,
        answerText: normalizeAnswerText(field.answerText),
      }))
      .filter((field) => field.answerText !== null)
      .sort((left, right) => left.fieldId - right.fieldId),
  });
}

export function hasAnswerContentChanged(
  previous: AnswerContent,
  next: AnswerContent,
): boolean {
  return (
    getAnswerContentFingerprint(previous) !==
    getAnswerContentFingerprint(next)
  );
}
