import type { EventSeriesAssignmentRole } from "./eventSeriesAccessPolicy";

export type AssignmentRoleCount = Record<EventSeriesAssignmentRole, number>;

export function countEventSeriesRoleAssignments(
  assignments: readonly { role: EventSeriesAssignmentRole }[],
): AssignmentRoleCount {
  return assignments.reduce<AssignmentRoleCount>(
    (counts, assignment) => ({
      ...counts,
      [assignment.role]: counts[assignment.role] + 1,
    }),
    { EVENT_MANAGER: 0, EDITOR: 0 },
  );
}

export function canAddEventSeriesRole(
  assignments: readonly { eventSeriesId: number }[],
  eventSeriesId: number,
) {
  return !assignments.some(
    (assignment) => assignment.eventSeriesId === eventSeriesId,
  );
}

export function getAvailableEventSeries<T extends { id: number }>(
  eventSeries: readonly T[],
  assignments: readonly { eventSeriesId: number }[],
) {
  const assignedIds = new Set(
    assignments.map((assignment) => assignment.eventSeriesId),
  );
  return eventSeries.filter((series) => !assignedIds.has(series.id));
}
