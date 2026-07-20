import {
  canControlEventSeriesLive,
  canEditEventSeriesQuestions,
  canManageEventSeries,
  canManageEventSeriesQuizzes,
  canReviewEventSeriesQuestions,
  canViewEventSeries,
  isAdministrator,
  type AuthorizationActor,
} from "@/app/roles/roleAssignmentPolicy";

export type EventSeriesAssignmentRole = "EVENT_MANAGER" | "EDITOR";

export type EventSeriesCapability =
  | "VIEW"
  | "EDIT"
  | "MANAGE_QUIZZES"
  | "CONTROL_LIVE"
  | "CREATE_QUESTION"
  | "REVIEW_QUESTION"
  | "MANAGE_MEMBERS"
  | "CHANGE_ARCHIVE_STATE";

export function isEventSeriesAssignmentRole(value: unknown): value is EventSeriesAssignmentRole {
  return value === "EVENT_MANAGER" || value === "EDITOR";
}

export function hasEventSeriesCapability(input: {
  actor: AuthorizationActor;
  eventSeriesId: number;
  capability: EventSeriesCapability;
}) {
  const { actor, eventSeriesId, capability } = input;
  if (capability === "VIEW") return canViewEventSeries(actor, eventSeriesId);
  if (capability === "EDIT") return canManageEventSeries(actor, eventSeriesId);
  if (capability === "MANAGE_QUIZZES") return canManageEventSeriesQuizzes(actor, eventSeriesId);
  if (capability === "CONTROL_LIVE") return canControlEventSeriesLive(actor, eventSeriesId);
  if (capability === "CREATE_QUESTION") return canEditEventSeriesQuestions(actor, eventSeriesId);
  if (capability === "REVIEW_QUESTION") return canReviewEventSeriesQuestions(actor, eventSeriesId);
  return isAdministrator(actor);
}

export function removingAssignmentLeavesNoEventManager(
  assignments: readonly { role: EventSeriesAssignmentRole }[],
  removedRole: EventSeriesAssignmentRole,
) {
  return removedRole === "EVENT_MANAGER" &&
    assignments.filter((assignment) => assignment.role === "EVENT_MANAGER").length <= 1;
}
