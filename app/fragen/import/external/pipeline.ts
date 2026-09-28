import { findDuplicateCandidates } from "./duplicates";
import {
  determineExternalQuestionQualityStatus,
  evaluateExternalQuestionQuality,
} from "./quality";
import type {
  ExistingQuestionForDuplicateCheck,
  ExternalQuestion,
  ExternalQuestionAutomationResult,
  ExternalQuestionEnrichment,
  PreparedExternalQuestion,
} from "./types";

export function prepareExternalQuestion(input: {
  question: ExternalQuestion;
  enrichment?: ExternalQuestionEnrichment | null;
  automation?: ExternalQuestionAutomationResult | null;
  existingQuestions?: readonly ExistingQuestionForDuplicateCheck[];
}): PreparedExternalQuestion {
  const automation = input.automation ?? null;
  const enrichment = input.enrichment ?? automation?.enrichment ?? null;
  const quality = evaluateExternalQuestionQuality({
    question: input.question,
    enrichment,
    automation,
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

  const autoRejected =
    quality.autoRejected || issues.has("POTENTIAL_EXACT_DUPLICATE");
  const issueList = [...issues];
  return {
    ...input.question,
    enrichment,
    automation,
    mappedDifficulty: quality.mappedDifficulty,
    suggestedCategoryName: quality.suggestedCategoryName,
    issues: issueList,
    autoRejected,
    duplicateCandidates,
    qualityStatus: determineExternalQuestionQualityStatus({
      autoRejected,
      automation,
      issues: issueList,
    }),
  };
}
