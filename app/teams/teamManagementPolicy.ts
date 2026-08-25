import {
  getActorEventSeriesIds,
  isAdministrator,
  type AuthorizationActor,
} from "@/app/roles/roleAssignmentPolicy";

export function getTeamManagementEventSeriesIds(actor: AuthorizationActor) {
  return isAdministrator(actor) ? null : getActorEventSeriesIds(actor, "EVENT_MANAGER");
}

export function canAccessTeamManagement(actor: AuthorizationActor) {
  const eventSeriesIds = getTeamManagementEventSeriesIds(actor);
  return eventSeriesIds === null || eventSeriesIds.length > 0;
}

export function canManageGlobalTeamLifecycle(actor: AuthorizationActor) {
  return isAdministrator(actor);
}

export function canAccessTeamFromEventSeries(
  actor: AuthorizationActor,
  teamEventSeriesIds: readonly number[],
) {
  const allowedIds = getTeamManagementEventSeriesIds(actor);
  return allowedIds === null || teamEventSeriesIds.some((id) => allowedIds.includes(id));
}
