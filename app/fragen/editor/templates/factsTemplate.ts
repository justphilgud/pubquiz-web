import { isCountryCode } from "@/app/lib/countries";
import type { QuestionAnswerDraft, QuestionTemplateData } from "../types";
import { questionTemplateIds } from "./questionTemplateRegistry";

export type FactsTemplateData = Extract<QuestionTemplateData, { kind: "FACTS" }>;
export const FACTS_MIN = 2;
export const FACTS_MAX = 7;
export const FACT_TEXT_MAX_LENGTH = 300;
export const YEAR_MIN = 1;
export const YEAR_MAX = 9999;

export function factsResponse(templateId: string | null): FactsTemplateData["response"] | null {
  if (templateId === questionTemplateIds.factsYear) return "YEAR";
  if (templateId === questionTemplateIds.factsCountry) return "COUNTRY";
  if (templateId === questionTemplateIds.factsText) return "TEXT";
  return null;
}

export function defaultFacts(response: FactsTemplateData["response"]): FactsTemplateData {
  return { kind: "FACTS", response, facts: [{ id: "fact-1", text: "" }, { id: "fact-2", text: "" }], solution: "", acceptedVariants: [], options: [] };
}

export function isValidYear(value: string): boolean {
  return /^[1-9]\d{0,3}$/.test(value) && Number(value) >= YEAR_MIN && Number(value) <= YEAR_MAX;
}

export function factsAnswers(data: FactsTemplateData, current: readonly QuestionAnswerDraft[]): QuestionAnswerDraft[] {
  const values = data.response === "TEXT" && data.options.length > 0
    ? data.options.map((option) => ({ key: option.id, text: option.text, isCorrect: option.isCorrect }))
    : [data.solution, ...(data.response === "TEXT" ? data.acceptedVariants : [])]
      .map((text, index) => ({ key: `solution-${index}`, text, isCorrect: true }));
  return values.map((value, index) => {
    const existing = current.find((answer) => answer.id === value.key) ?? current[index];
    return { id: value.key, answerId: existing?.answerId, text: value.text, isCorrect: value.isCorrect, additionalInfo: "", media: null };
  });
}

export function parseFacts(value: unknown, response: FactsTemplateData["response"], complete: boolean): FactsTemplateData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<FactsTemplateData>;
  if (data.kind !== "FACTS" || data.response !== response || typeof data.solution !== "string" ||
      !Array.isArray(data.facts) || !Array.isArray(data.acceptedVariants) || !Array.isArray(data.options)) return null;
  if (data.facts.length < FACTS_MIN || data.facts.length > FACTS_MAX ||
      data.facts.some((fact) => !fact || typeof fact.id !== "string" || !fact.id.trim() || typeof fact.text !== "string" || !fact.text.trim() || fact.text.length > FACT_TEXT_MAX_LENGTH) ||
      new Set(data.facts.map((fact) => fact.id)).size !== data.facts.length) return null;
  if (data.solution.length > 200 || data.acceptedVariants.some((variant) => typeof variant !== "string" || !variant.trim() || variant.length > 200) ||
      data.options.some((option) => !option || typeof option.id !== "string" || !option.id.trim() || typeof option.text !== "string" || option.text.length > 200 || typeof option.isCorrect !== "boolean") ||
      new Set(data.options.map((option) => option.id)).size !== data.options.length) return null;
  if (response !== "TEXT" && (data.options.length || data.acceptedVariants.length)) return null;
  if (response === "COUNTRY" && data.solution && !isCountryCode(data.solution)) return null;
  if (response === "YEAR" && data.solution && !isValidYear(data.solution)) return null;
  if (data.options.length && (data.options.length < 2 || data.options.filter((option) => option.isCorrect).length !== 1 || data.acceptedVariants.length)) return null;
  if (complete && (data.options.length ? data.options.some((option) => !option.text.trim()) : !data.solution.trim())) return null;
  return data as FactsTemplateData;
}
