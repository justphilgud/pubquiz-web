import { findDuplicateCandidates } from "./duplicates";
import { evaluateExternalQuestionQuality } from "./quality";
import type {
  ExistingQuestionForDuplicateCheck,
  ExternalQuestion,
  ExternalQuestionEnrichment,
  PreparedExternalQuestion,
} from "./types";

export function prepareExternalQuestion(input: {
  question: ExternalQuestion;
  enrichment?: ExternalQuestionEnrichment | null;
  existingQuestions?: readonly ExistingQuestionForDuplicateCheck[];
}): PreparedExternalQuestion {
  const enrichment = input.enrichment ?? null;
  const quality = evaluateExternalQuestionQuality({
    question: input.question,
    enrichment,
  });
  const duplicateCandidates = findDuplicateCandidates(
    enrichment?.question ?? input.question.question,
    input.existingQuestions ?? [],
  );
  const issues = new Set(quality.issues);
  if (duplicateCandidates.some((candidate) => candidate.kind === "EXACT")) {
    issues.add("POTENTIAL_EXACT_DUPLICATE");
  } else if (duplicateCandidates.length > 0) {
    issues.add("POTENTIAL_SEMANTIC_DUPLICATE");
  }

  return {
    ...input.question,
    enrichment,
    mappedDifficulty: quality.mappedDifficulty,
    suggestedCategoryName: quality.suggestedCategoryName,
    issues: [...issues],
    autoRejected:
      quality.autoRejected || issues.has("POTENTIAL_EXACT_DUPLICATE"),
    duplicateCandidates,
  };
}
