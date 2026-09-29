import { prepareExternalQuestion } from "./pipeline";
import {
  EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION,
  type ExternalImportPlanItem,
} from "./productionImportGuard";
import { countIndependentReliableSourceHosts } from "./sourceReliability";
import type {
  ExistingQuestionForDuplicateCheck,
  ExternalQuestion,
  ExternalQuestionAutomationResult,
  PreparedExternalQuestion,
} from "./types";
export { countIndependentReliableSourceHosts } from "./sourceReliability";

export type ProductionAutoQualityFailure =
  | "ANSWER_SET_INVALID"
  | "CATEGORY_MISSING"
  | "INSUFFICIENT_INDEPENDENT_SOURCES"
  | "LOCALIZATION_NOT_LOCALIZED"
  | "QUALITY_NOT_READY"
  | "VERIFICATION_NOT_VERIFIED";

export type ProductionAutoQualityAssessment = Readonly<{
  classification: "AUTO_APPROVED_FOR_PRODUCTION" | "NOT_AUTO_APPROVED";
  eligible: boolean;
  failures: readonly ProductionAutoQualityFailure[];
  independentReliableSourceHosts: number;
  prepared: PreparedExternalQuestion;
}>;

export function assessProductionAutoQuality(input: {
  question: ExternalQuestion;
  automation: ExternalQuestionAutomationResult;
  existingQuestions?: readonly ExistingQuestionForDuplicateCheck[];
}): ProductionAutoQualityAssessment {
  const prepared = prepareExternalQuestion({
    question: input.question,
    automation: input.automation,
    existingQuestions: input.existingQuestions,
  });
  const failures = new Set<ProductionAutoQualityFailure>();
  const answers = [
    input.automation.enrichment.correctAnswer,
    ...input.automation.enrichment.incorrectAnswers,
  ].map((answer) => answer.trim().toLocaleLowerCase("de"));
  const independentReliableSourceHosts = countIndependentReliableSourceHosts(
    input.automation.verificationSources,
  );

  if (input.automation.verificationStatus !== "VERIFIED") {
    failures.add("VERIFICATION_NOT_VERIFIED");
  }
  if (input.automation.localizationStatus !== "LOCALIZED") {
    failures.add("LOCALIZATION_NOT_LOCALIZED");
  }
  if (prepared.qualityStatus !== "READY_FOR_REVIEW" || prepared.issues.length > 0) {
    failures.add("QUALITY_NOT_READY");
  }
  if (answers.length !== 4 || answers.some((answer) => !answer) || new Set(answers).size !== 4) {
    failures.add("ANSWER_SET_INVALID");
  }
  if (!prepared.suggestedCategoryName.trim()) failures.add("CATEGORY_MISSING");
  if (independentReliableSourceHosts < 2) {
    failures.add("INSUFFICIENT_INDEPENDENT_SOURCES");
  }

  return {
    classification: failures.size === 0
      ? "AUTO_APPROVED_FOR_PRODUCTION"
      : "NOT_AUTO_APPROVED",
    eligible: failures.size === 0,
    failures: [...failures],
    independentReliableSourceHosts,
    prepared,
  };
}

export function toAutoApprovedPlanItem(input: {
  candidateId: string;
  question: ExternalQuestion;
  automation: ExternalQuestionAutomationResult;
  assessment: ProductionAutoQualityAssessment;
}): ExternalImportPlanItem {
  if (!input.assessment.eligible) {
    throw new Error("EXTERNAL_IMPORT_CANDIDATE_NOT_AUTO_APPROVED");
  }
  const enrichment = input.automation.enrichment;
  return {
    candidateId: input.candidateId,
    externalReference: input.question.externalReference,
    contentFingerprint: input.question.contentFingerprint,
    original: {
      language: input.question.originalLanguage,
      category: input.question.category,
      difficulty: input.question.difficulty,
      type: input.question.type,
      question: input.question.question,
      correctAnswer: input.question.correctAnswer,
      incorrectAnswers: input.question.incorrectAnswers,
      providerPayload: input.question.providerPayload,
    },
    prepared: {
      question: enrichment.question,
      correctAnswer: enrichment.correctAnswer,
      distractors: enrichment.incorrectAnswers,
      explanation: enrichment.explanation,
      difficulty: input.assessment.prepared.mappedDifficulty,
      category: input.assessment.prepared.suggestedCategoryName,
    },
    verification: {
      status: input.automation.verificationStatus,
      sources: input.automation.verificationSources,
    },
    autoQualityEvidence: {
      classification: "AUTO_APPROVED_FOR_PRODUCTION",
      policyVersion: EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION,
      localizationStatus: "LOCALIZED",
      qualityStatus: "READY_FOR_REVIEW",
      issueCodes: [],
      independentReliableSourceHosts:
        input.assessment.independentReliableSourceHosts,
    },
    reviewStatus: "READY_FOR_REVIEW",
    license: {
      name: input.question.license,
      url: input.question.licenseUrl,
    },
    media: [],
  };
}
