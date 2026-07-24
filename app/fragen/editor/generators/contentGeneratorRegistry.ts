import type { QuestionContentGeneratorId } from "../types";
import { generateAnagramSuggestions } from "../templates/questionTemplateData";

export type QuestionContentGeneratorDefinition = {
  id: QuestionContentGeneratorId;
  execution: "LOCAL" | "PROVIDER";
  enabled: boolean;
  supportedTemplates: readonly string[];
};

export const questionContentGeneratorDefinitions = [
  {
    id: "anagram_generate",
    execution: "LOCAL",
    enabled: true,
    supportedTemplates: ["anagramm"],
  },
  {
    id: "text_translation",
    execution: "PROVIDER",
    enabled: false,
    supportedTemplates: ["uebersetzt_vorgelesen"],
  },
  {
    id: "text_to_speech",
    execution: "PROVIDER",
    enabled: false,
    supportedTemplates: ["uebersetzt_vorgelesen", "google_rezensionen"],
  },
] as const satisfies readonly QuestionContentGeneratorDefinition[];

export function getQuestionContentGenerator(
  id: QuestionContentGeneratorId,
) {
  return questionContentGeneratorDefinitions.find(
    (definition) => definition.id === id,
  ) ?? null;
}

export function runLocalContentGenerator(
  id: QuestionContentGeneratorId,
  input: string,
): string[] | null {
  return id === "anagram_generate"
    ? generateAnagramSuggestions(input)
    : null;
}
