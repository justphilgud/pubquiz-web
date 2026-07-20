import type { EventSeriesAssignmentRole } from "@/app/eventreihen/eventSeriesAccessPolicy";

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

export type QuestionActorContext = {
  globalRole: string | null | undefined;
  userId: number | null;
  assignments: ReadonlyMap<number, EventSeriesAssignmentRole>;
};

function hasEverySeries(
  actor: QuestionActorContext,
  eventSeriesIds: readonly number[],
  requiredRole?: EventSeriesAssignmentRole,
) {
  return eventSeriesIds.length > 0 && eventSeriesIds.every((id) => {
    const role = actor.assignments.get(id);
    return requiredRole ? role === requiredRole : role === "EVENT_MANAGER" || role === "EDITOR";
  });
}

export function canUseQuestionScope(
  actor: QuestionActorContext,
  scope: QuestionScopeValue,
  eventSeriesIds: readonly number[],
) {
  if (actor.globalRole === "ADMIN") {
    return scope === "GLOBAL" || eventSeriesIds.length > 0;
  }
  return scope === "EVENT_SERIES" && hasEverySeries(actor, eventSeriesIds);
}

export function canViewScopedQuestion(actor: QuestionActorContext, question: QuestionScopeAccessContext) {
  if (actor.globalRole === "ADMIN") return true;
  if (question.scope === "GLOBAL") {
    if (question.isApproved) return true;
    return actor.userId !== null && actor.userId === question.createdByUserId;
  }
  return question.eventSeriesIds.some((id) => actor.assignments.has(id));
}

export function canEditScopedQuestion(actor: QuestionActorContext, question: QuestionScopeAccessContext) {
  if (actor.globalRole === "ADMIN") return true;
  if (question.isArchived) return false;
  if (question.scope === "GLOBAL") {
    return actor.userId !== null && actor.userId === question.createdByUserId &&
      (question.reviewStatus === "DRAFT" || question.reviewStatus === "CHANGES_REQUESTED");
  }
  if (hasEverySeries(actor, question.eventSeriesIds, "EVENT_MANAGER")) return true;
  return actor.userId !== null &&
    actor.userId === question.createdByUserId &&
    (question.reviewStatus === "DRAFT" || question.reviewStatus === "CHANGES_REQUESTED") &&
    hasEverySeries(actor, question.eventSeriesIds);
}

export function canApproveScopedQuestion(actor: QuestionActorContext, question: QuestionScopeAccessContext) {
  if (actor.globalRole === "ADMIN") return true;
  return question.scope === "EVENT_SERIES" &&
    !question.isArchived &&
    hasEverySeries(actor, question.eventSeriesIds, "EVENT_MANAGER");
}

export function canRequestChangesForScopedQuestion(actor: QuestionActorContext, question: QuestionScopeAccessContext) {
  return question.reviewStatus === "IN_REVIEW" && canApproveScopedQuestion(actor, question);
}

export function canCloneScopedQuestion(actor: QuestionActorContext, question: QuestionScopeAccessContext) {
  if (!canViewScopedQuestion(actor, question)) return false;
  if (actor.globalRole === "ADMIN") return true;
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
