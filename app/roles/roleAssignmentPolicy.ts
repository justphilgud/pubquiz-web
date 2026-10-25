import { isEventType, type EventType, type EventTypeRole } from "./eventTypes";

export const ROLE_ASSIGNMENT_ROLES = ["ADMIN", "EDITOR", "EVENT_MANAGER"] as const;

export type RoleAssignmentRoleValue = (typeof ROLE_ASSIGNMENT_ROLES)[number];
export type RoleScopeTypeValue = "GLOBAL" | "EVENT_SERIES";

export type RoleAssignmentSnapshot = {
  id?: number;
  role: unknown;
  scopeType: unknown;
  eventSeriesId: number | null;
};

export type AuthorizationActor = {
  userId: number;
  /** Effective Quiz assignments only; never raw legacy series rows. */
  assignments: readonly RoleAssignmentSnapshot[];
  eventTypeAssignments?: readonly { eventSeriesId: number; eventType: string; role: string; enabled: boolean }[];
  managedEventSeriesIds?: readonly number[];
};

export function isRoleAssignmentRole(value: unknown): value is RoleAssignmentRoleValue {
  return ROLE_ASSIGNMENT_ROLES.some((role) => role === value);
}

export function isRoleScopeType(value: unknown): value is RoleScopeTypeValue {
  return value === "GLOBAL" || value === "EVENT_SERIES";
}

export function isValidRoleAssignment(
  assignment: RoleAssignmentSnapshot,
): boolean {
  if (!isRoleAssignmentRole(assignment.role) || !isRoleScopeType(assignment.scopeType)) {
    return false;
  }
  if (assignment.scopeType === "GLOBAL") {
    return assignment.eventSeriesId === null &&
      (assignment.role === "ADMIN" || assignment.role === "EDITOR");
  }
  return Number.isInteger(assignment.eventSeriesId) &&
    Number(assignment.eventSeriesId) > 0 &&
    (assignment.role === "EDITOR" || assignment.role === "EVENT_MANAGER");
}

function validAssignments(actor: AuthorizationActor) {
  return actor.assignments.filter(isValidRoleAssignment);
}

export function hasGlobalRole(actor: AuthorizationActor, role: "ADMIN" | "EDITOR") {
  return validAssignments(actor).some(
    (assignment) => assignment.scopeType === "GLOBAL" && assignment.role === role,
  );
}

export function hasEventSeriesRole(
  actor: AuthorizationActor,
  eventSeriesId: number,
  role: "EDITOR" | "EVENT_MANAGER",
) {
  return validAssignments(actor).some(
    (assignment) => assignment.scopeType === "EVENT_SERIES" &&
      assignment.eventSeriesId === eventSeriesId && assignment.role === role,
  );
}

export function getActorEventSeriesIds(
  actor: AuthorizationActor,
  role?: "EDITOR" | "EVENT_MANAGER",
) {
  return [...new Set(validAssignments(actor).flatMap((assignment) =>
    assignment.scopeType === "EVENT_SERIES" &&
    (!role || assignment.role === role) &&
    assignment.eventSeriesId !== null
      ? [assignment.eventSeriesId]
      : [],
  ))];
}

export function isAdministrator(actor: AuthorizationActor) {
  return hasGlobalRole(actor, "ADMIN");
}

export function canManageUsers(actor: AuthorizationActor) {
  return isAdministrator(actor);
}

export function canEditGlobalQuestions(actor: AuthorizationActor) {
  return isAdministrator(actor) || hasGlobalRole(actor, "EDITOR");
}

export function canEditEventSeriesQuestions(actor: AuthorizationActor, eventSeriesId: number) {
  return isAdministrator(actor) ||
    hasEventSeriesRole(actor, eventSeriesId, "EDITOR") ||
    hasEventSeriesRole(actor, eventSeriesId, "EVENT_MANAGER");
}

export function canReviewEventSeriesQuestions(actor: AuthorizationActor, eventSeriesId: number) {
  return isAdministrator(actor) || hasEventSeriesRole(actor, eventSeriesId, "EVENT_MANAGER");
}

export function canManageEventSeries(actor: AuthorizationActor, eventSeriesId: number) {
  return isAdministrator(actor) || (actor.managedEventSeriesIds ?? []).includes(eventSeriesId);
}

export function canManageEventSeriesQuizzes(actor: AuthorizationActor, eventSeriesId: number) {
  return isAdministrator(actor) || hasEventSeriesRole(actor, eventSeriesId, "EVENT_MANAGER");
}

export function canControlEventSeriesLive(actor: AuthorizationActor, eventSeriesId: number) {
  return isAdministrator(actor) || hasEventSeriesRole(actor, eventSeriesId, "EVENT_MANAGER");
}

export function canViewEventSeries(actor: AuthorizationActor, eventSeriesId: number) {
  return isAdministrator(actor) || getVisibleEventSeriesIds(actor).includes(eventSeriesId);
}

export function hasAnyEditorialAssignment(actor: AuthorizationActor) {
  return canEditGlobalQuestions(actor) || getActorEventSeriesIds(actor).length > 0;
}

export function isLastActiveRoleHolder(activeHolderCount: number) {
  return Number.isInteger(activeHolderCount) && activeHolderCount <= 1;
}

/** Object checks must be applied in addition to this product/role gate. */
export function hasEventTypeAccess(actor: AuthorizationActor, eventSeriesId: number, eventType: EventType, minimum: EventTypeRole = "EDITOR") {
  if (!Number.isInteger(eventSeriesId) || eventSeriesId <= 0 || !isEventType(eventType)) return false;
  if (isAdministrator(actor)) return true;
  return (actor.eventTypeAssignments ?? []).some(assignment => assignment.eventSeriesId === eventSeriesId &&
    assignment.eventType === eventType && assignment.enabled &&
    (assignment.role === "EVENT_MANAGER" || (minimum === "EDITOR" && assignment.role === "EDITOR")));
}
export function getVisibleEventSeriesIds(actor: AuthorizationActor) {
  return [...new Set([...(actor.managedEventSeriesIds ?? []), ...(actor.eventTypeAssignments ?? []).flatMap(a =>
    a.enabled && isEventType(a.eventType) && (a.role === "EDITOR" || a.role === "EVENT_MANAGER") ? [a.eventSeriesId] : []),
    ...getActorEventSeriesIds(actor)])];
}
