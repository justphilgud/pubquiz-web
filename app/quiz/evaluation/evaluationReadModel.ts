import {
  isEvaluationComplete,
  type EvaluationCompletenessInput,
} from "./evaluationCompleteness";

export type EvaluationReadStatus =
  | "NOT_PLAYED"
  | "PENDING"
  | "UNANSWERED"
  | "WRONG"
  | "PARTIAL"
  | "CORRECT"
  | "REVIEW_REQUIRED";

const persistedStatuses = new Set<EvaluationReadStatus>([
  "UNANSWERED",
  "WRONG",
  "PARTIAL",
  "CORRECT",
  "REVIEW_REQUIRED",
]);

// Runtime contract: docs/architecture/quiz-runtime-contracts.md
// An effective submission with pending evaluation is never unanswered.
export function resolveEvaluationReadState(input: {
  isPlayed: boolean;
  hasEffectiveSubmission: boolean;
  evaluation: EvaluationCompletenessInput | null;
}) {
  if (!input.isPlayed) {
    return {
      isNotPlayed: true,
      isUnanswered: false,
      isPending: false,
      status: "NOT_PLAYED" as const,
    };
  }

  if (!input.hasEffectiveSubmission) {
    return {
      isNotPlayed: false,
      isUnanswered: true,
      isPending: false,
      status: "UNANSWERED" as const,
    };
  }

  if (!input.evaluation || !isEvaluationComplete(input.evaluation)) {
    return {
      isNotPlayed: false,
      isUnanswered: false,
      isPending: true,
      status: "PENDING" as const,
    };
  }

  const persistedStatus = input.evaluation.bewertungsstatus;
  return {
    isNotPlayed: false,
    isUnanswered: false,
    isPending: false,
    status:
      typeof persistedStatus === "string" &&
      persistedStatuses.has(persistedStatus as EvaluationReadStatus)
        ? (persistedStatus as Exclude<EvaluationReadStatus, "NOT_PLAYED" | "PENDING">)
        : "UNANSWERED",
  };
}
