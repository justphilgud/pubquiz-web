import type { EventSeriesAssignmentRole } from "./eventSeriesAccessPolicy";

export type MembershipRoleCount = Record<EventSeriesAssignmentRole, number>;

export function countMembershipRoles(
  memberships: readonly { role: EventSeriesAssignmentRole }[],
): MembershipRoleCount {
  return memberships.reduce<MembershipRoleCount>(
    (counts, membership) => ({
      ...counts,
      [membership.role]: counts[membership.role] + 1,
    }),
    { EVENT_MANAGER: 0, EVENT_EDITOR: 0 },
  );
}

export function canAddMembership(
  memberships: readonly { eventSeriesId: number }[],
  eventSeriesId: number,
) {
  return !memberships.some(
    (membership) => membership.eventSeriesId === eventSeriesId,
  );
}

export function getAvailableEventSeries<T extends { id: number }>(
  eventSeries: readonly T[],
  memberships: readonly { eventSeriesId: number }[],
) {
  const assignedIds = new Set(
    memberships.map((membership) => membership.eventSeriesId),
  );
  return eventSeries.filter((series) => !assignedIds.has(series.id));
}
