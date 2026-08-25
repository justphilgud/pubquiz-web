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

export type TeamProfileCapability = "UPLOAD_PHOTO" | "CHOOSE_AVATAR" | "REMOVE_PHOTO" | "LOCK_PHOTO_UPLOAD";

export function canManageTeamProfile(actor: AuthorizationActor, capability: TeamProfileCapability) {
  if (isAdministrator(actor)) return true;
  if (getActorEventSeriesIds(actor, "EVENT_MANAGER").length === 0) return false;
  return capability === "REMOVE_PHOTO" || capability === "LOCK_PHOTO_UPLOAD";
}

export function canAccessTeamFromEventSeries(
  actor: AuthorizationActor,
  teamEventSeriesIds: readonly number[],
) {
  const allowedIds = getTeamManagementEventSeriesIds(actor);
  return allowedIds === null || teamEventSeriesIds.some((id) => allowedIds.includes(id));
}
