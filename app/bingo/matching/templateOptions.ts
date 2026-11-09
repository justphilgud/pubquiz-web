/** Stable template identities, including dynamic source templates. No question content. */
export type MatchingTemplateOption = { code: string; name: string };
export const GENERAL_TEMPLATE = '__general__';
export function matchingTemplateOption(question: {
  vorlage: MatchingTemplateOption | null;
  source_vorlage: MatchingTemplateOption | null;
}): MatchingTemplateOption {
  return question.source_vorlage ?? question.vorlage ?? { code: GENERAL_TEMPLATE, name: 'Allgemeine Frage' };
}
