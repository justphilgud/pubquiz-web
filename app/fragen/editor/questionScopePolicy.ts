import {
  canEditEventSeriesQuestions,
  canEditGlobalQuestions,
  canReviewEventSeriesQuestions,
  isAdministrator,
  type AuthorizationActor,
} from "@/app/roles/roleAssignmentPolicy";

export type QuestionScopeValue = "GLOBAL" | "EVENT_SERIES";
export type QuestionReviewStatusValue = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";

export type QuestionScopeAccessContext = {
  scope: QuestionScopeValue;
  eventSeriesIds: number[];
  createdByUserId: number | null;
  reviewStatus: QuestionReviewStatusValue;
  isArchived: boolean;
  isApproved: boolean;
};

export type QuestionActorContext = AuthorizationActor;

function hasEverySeries(
  actor: QuestionActorContext,
  eventSeriesIds: readonly number[],
  capability: "EDIT" | "REVIEW" = "EDIT",
) {
  return eventSeriesIds.length > 0 && eventSeriesIds.every((id) =>
    capability === "REVIEW"
      ? canReviewEventSeriesQuestions(actor, id)
      : canEditEventSeriesQuestions(actor, id),
  );
}

export function canUseQuestionScope(
  actor: QuestionActorContext,
  scope: QuestionScopeValue,
  eventSeriesIds: readonly number[],
) {
  if (scope === "GLOBAL") {
    return eventSeriesIds.length === 0 && canEditGlobalQuestions(actor);
  }
  return scope === "EVENT_SERIES" && hasEverySeries(actor, eventSeriesIds);
}

export function canViewScopedQuestion(actor: QuestionActorContext, question: QuestionScopeAccessContext) {
  if (isAdministrator(actor)) return true;
  if (question.scope === "GLOBAL") {
    if (question.isApproved) return true;
    return canEditGlobalQuestions(actor) && actor.userId === question.createdByUserId;
  }
  return question.eventSeriesIds.some((id) => canEditEventSeriesQuestions(actor, id));
}

export function canEditScopedQuestion(actor: QuestionActorContext, question: QuestionScopeAccessContext) {
  if (isAdministrator(actor)) return true;
  if (question.isArchived) return false;
  if (question.scope === "GLOBAL") {
    return canEditGlobalQuestions(actor) && actor.userId === question.createdByUserId &&
      (question.reviewStatus === "DRAFT" || question.reviewStatus === "CHANGES_REQUESTED");
  }
  if (hasEverySeries(actor, question.eventSeriesIds, "REVIEW")) return true;
  return actor.userId === question.createdByUserId &&
    (question.reviewStatus === "DRAFT" || question.reviewStatus === "CHANGES_REQUESTED") &&
    hasEverySeries(actor, question.eventSeriesIds);
}

export function canApproveScopedQuestion(actor: QuestionActorContext, question: QuestionScopeAccessContext) {
  if (isAdministrator(actor)) return true;
  return question.scope === "EVENT_SERIES" && !question.isArchived &&
    hasEverySeries(actor, question.eventSeriesIds, "REVIEW");
}

export function canRequestChangesForScopedQuestion(actor: QuestionActorContext, question: QuestionScopeAccessContext) {
  return question.reviewStatus === "IN_REVIEW" && canApproveScopedQuestion(actor, question);
}

export function canCloneScopedQuestion(actor: QuestionActorContext, question: QuestionScopeAccessContext) {
  if (!canViewScopedQuestion(actor, question)) return false;
  if (isAdministrator(actor)) return true;
  return question.scope === "EVENT_SERIES" && hasEverySeries(actor, question.eventSeriesIds);
}

export function isQuestionEligibleForQuiz(input: {
  scope: QuestionScopeValue;
  eventSeriesIds: readonly number[];
  quizEventSeriesId: number;
  isApproved: boolean;
  isArchived: boolean;
  validUntil: Date | null;
  now: Date;
}) {
  if (!input.isApproved || input.isArchived) return false;
  if (input.validUntil && input.validUntil < input.now) return false;
  return input.scope === "GLOBAL" || input.eventSeriesIds.includes(input.quizEventSeriesId);
}
