import type {
  QuestionAnswerMode,
  QuestionEvaluationMode,
  QuestionTemplateConfig,
  QuestionTemplateData,
} from "../types";
import { getQuestionTemplateDefinition } from "./questionTemplates";

export type QuestionTemplateRuntimeModel = {
  answerMode: QuestionAnswerMode;
  evaluationMode: QuestionEvaluationMode;
  prompt: string;
  solutionLines: string[];
  sequentialReveal: boolean;
  templateData?: QuestionTemplateData;
};

export function buildQuestionTemplateRuntimeModel(input: {
  templateId: string | null;
  questionText: string;
  templateConfig: QuestionTemplateConfig | null;
  correctAnswers: readonly { text: string; additionalInfo?: string | null }[];
}): QuestionTemplateRuntimeModel {
  const definition = getQuestionTemplateDefinition(input.templateId);
  const data = input.templateConfig?.templateData;
  const fallbackLines = input.correctAnswers.map((answer) => answer.text);
  const base = {
    answerMode: definition?.answerMode ?? "OPEN_TEXT",
    evaluationMode: definition?.evaluationMode ?? "MANUAL",
    prompt: input.questionText,
    sequentialReveal: false,
    ...(data ? { templateData: data } : {}),
  };

  if (data?.kind === "TRUE_FALSE") {
    return { ...base, solutionLines: [data.correctAnswer ? "Wahr" : "Falsch", data.explanation].filter(Boolean) };
  }
  if (data?.kind === "ESTIMATE") {
    const value = data.correctValue === null ? "" : `${data.correctValue}${data.unit ? ` ${data.unit}` : ""}`;
    return { ...base, solutionLines: [value, data.explanation].filter(Boolean) };
  }
  if (data?.kind === "ORDERING") {
    return { ...base, solutionLines: data.items.map((item, index) => `${index + 1}. ${item.text}${item.explanation ? ` – ${item.explanation}` : ""}`) };
  }
  if (data?.kind === "TRANSLATION_READ_ALOUD") {
    return {
      ...base,
      solutionLines: [
        ...fallbackLines,
        data.translation,
      ].filter(Boolean),
    };
  }
  if (data?.kind === "ANAGRAM") {
    return { ...base, solutionLines: [data.name] };
  }
  if (data?.kind === "GOOGLE_REVIEWS") {
    const source = data.placeMapsUrl;
    return {
      ...base,
      solutionLines: [
        [data.placeName, data.placeAdditionalLabel].filter(Boolean).join(" · "),
        data.explanation,
        source
          ? `Google Maps: ${source}${data.placeImportedOrEditedAt ? ` (redaktionell übernommen/bearbeitet am ${data.placeImportedOrEditedAt.slice(0, 10)})` : ""}`
          : "",
        ...data.reviews.flatMap((review, index) => [
          review.attributionText
            ? `Attribution Rezension ${index + 1}: ${review.attributionText}`
            : "",
          review.sourceUrl
            ? `Quelle Rezension ${index + 1}: ${review.sourceUrl}`
            : "",
        ]),
      ].filter(Boolean),
      sequentialReveal: data.sequentialReveal,
    };
  }
  return { ...base, solutionLines: fallbackLines };
}

export function evaluateStructuredAnswer(
  data: QuestionTemplateData,
  submitted: string,
): boolean | null {
  if (data.kind === "TRUE_FALSE") {
    return submitted.trim().toLocaleLowerCase("de-DE") === (data.correctAnswer ? "wahr" : "falsch");
  }
  if (data.kind === "ANAGRAM") {
    return submitted.trim().localeCompare(data.name.trim(), "de-DE", { sensitivity: "base" }) === 0;
  }
  if (data.kind === "ORDERING") {
    try {
      const order: unknown = JSON.parse(submitted);
      return Array.isArray(order) &&
        order.length === data.items.length &&
        order.every((id, index) => id === data.items[index].id);
    } catch {
      return false;
    }
  }
  if (data.kind === "ESTIMATE" && data.tolerance !== null && data.correctValue !== null) {
    const value = Number(submitted);
    return Number.isFinite(value) && Math.abs(value - data.correctValue) <= data.tolerance;
  }
  return null;
}
