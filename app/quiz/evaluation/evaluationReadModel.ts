import {
  isEvaluationComplete,
  type EvaluationCompletenessInput,
} from "./evaluationCompleteness";

export type EvaluationReadStatus =
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

export function resolveEvaluationReadState(input: {
  hasEffectiveSubmission: boolean;
  evaluation: EvaluationCompletenessInput | null;
}) {
  if (!input.hasEffectiveSubmission) {
    return {
      isUnanswered: true,
      isPending: false,
      status: "UNANSWERED" as const,
    };
  }

  if (!input.evaluation || !isEvaluationComplete(input.evaluation)) {
    return {
      isUnanswered: false,
      isPending: true,
      status: "PENDING" as const,
    };
  }

  const persistedStatus = input.evaluation.bewertungsstatus;
  return {
    isUnanswered: false,
    isPending: false,
    status:
      typeof persistedStatus === "string" &&
      persistedStatuses.has(persistedStatus as EvaluationReadStatus)
        ? (persistedStatus as Exclude<EvaluationReadStatus, "PENDING">)
        : "UNANSWERED",
  };
}
