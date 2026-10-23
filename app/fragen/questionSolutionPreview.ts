import { countryName } from "@/app/lib/countries";
import type { QuestionTemplateData } from "./editor/types";

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
  templateId?: string | null;
  structuredFields: readonly StructuredAnswerField[];
  templateData?: QuestionTemplateData | null;
  maxValues?: number;
}): QuestionSolutionPreview | null {
  const data = input.templateData;
  const canonical = data?.kind === "ORDERING" ? data.items.map((item, index) => `${index + 1}. ${item.text}`)
    : data?.kind === "TRUE_FALSE" ? [data.correctAnswer ? "Wahr" : "Falsch"]
    : data?.kind === "ESTIMATE" ? data.correctValue === null ? [] : [`${data.correctValue}${data.unit ? ` ${data.unit}` : ""}`]
    : data?.kind === "FACTS" ? [data.response === "COUNTRY" ? countryName(data.solution) : data.solution]
    : data?.kind === "ANAGRAM" ? [data.name]
    : data?.kind === "TRANSLATION_READ_ALOUD" ? [data.originalText]
    : data?.kind === "GOOGLE_REVIEWS" ? [data.placeName] : [];
  const classicSolutions = uniqueNonEmpty(
    input.classicAnswers.flatMap((answer) => answer.isCorrect ? [input.templateId === "fakten_land" ? countryName(answer.text) : answer.text] : []),
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
  const solutions = uniqueNonEmpty([...(canonical.length ? canonical : classicSolutions), ...structuredSolutions]);
  if (solutions.length === 0) return null;

  return {
    label: solutions.length === 1 ? "Richtige Lösung" : "Richtige Lösungen",
    values: solutions.slice(0, input.maxValues ?? MAX_PREVIEW_VALUES),
    remainingCount: Math.max(0, solutions.length - (input.maxValues ?? MAX_PREVIEW_VALUES)),
  };
}
