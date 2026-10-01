export type QuestionSolutionPreview = {
  label: "Richtige Lösung" | "Richtige Lösungen";
  values: string[];
  remainingCount: number;
};

type ClassicAnswer = {
  text: string;
  isCorrect: boolean;
};

type StructuredAnswerField = {
  label: string;
  solutions: Array<{
    text: string;
    isAccepted: boolean;
  }>;
};

const MAX_PREVIEW_VALUES = 3;

function uniqueNonEmpty(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildQuestionSolutionPreview(input: {
  classicAnswers: readonly ClassicAnswer[];
  structuredFields: readonly StructuredAnswerField[];
}): QuestionSolutionPreview | null {
  const classicSolutions = uniqueNonEmpty(
    input.classicAnswers.flatMap((answer) => answer.isCorrect ? [answer.text] : []),
  );
  const structuredSolutions = uniqueNonEmpty(
    input.structuredFields.flatMap((field) =>
      field.solutions.flatMap((solution) =>
        solution.isAccepted
          ? [`${field.label.trim() ? `${field.label.trim()}: ` : ""}${solution.text}`]
          : [],
      ),
    ),
  );
  const solutions = uniqueNonEmpty([...classicSolutions, ...structuredSolutions]);
  if (solutions.length === 0) return null;

  return {
    label: solutions.length === 1 ? "Richtige Lösung" : "Richtige Lösungen",
    values: solutions.slice(0, MAX_PREVIEW_VALUES),
    remainingCount: Math.max(0, solutions.length - MAX_PREVIEW_VALUES),
  };
}
