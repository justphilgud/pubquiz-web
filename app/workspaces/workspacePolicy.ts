import { EVENT_TYPES, type EventType } from "@/app/roles/eventTypes";
import { canManageEventSeries, hasAnyEditorialAssignment, hasEventTypeAccess, isAdministrator, type AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";

export type WorkspaceSeries = { id: number; name: string; products: readonly string[] };
export type WorkspaceChoice = WorkspaceSeries & { eventTypes: EventType[]; canManage: boolean; canManageQuiz: boolean };
export const workspaceTypePaths: Record<EventType, string> = { QUIZ: "quiz", BINGO: "bingo", POWERPOINT_KARAOKE: "karaoke" };
export function workspaceHref(series: WorkspaceChoice, type?: EventType) {
  const selected = type && series.eventTypes.includes(type) ? type : series.eventTypes[0];
  return `/workspaces/${series.id}/${selected ? workspaceTypePaths[selected] : "settings"}`;
}
export function getWorkspaceChoices(actor: AuthorizationActor, series: readonly WorkspaceSeries[]): WorkspaceChoice[] {
  return series.flatMap(row => {
    const eventTypes = EVENT_TYPES.filter(type => row.products.includes(type.id) && hasEventTypeAccess(actor, row.id, type.id)).map(type => type.id);
    const canManage = canManageEventSeries(actor, row.id);
    return eventTypes.length || canManage ? [{ ...row, eventTypes, canManage, canManageQuiz: eventTypes.includes("QUIZ") && hasEventTypeAccess(actor, row.id, "QUIZ", "EVENT_MANAGER") }] : [];
  });
}
export function canAccessCrossSeriesContent(actor: AuthorizationActor) { return hasAnyEditorialAssignment(actor); }
export function canAccessGlobalAdministration(actor: AuthorizationActor) { return isAdministrator(actor); }
export function searchWorkspaceChoices(choices: readonly WorkspaceChoice[], search: string) {
  const query = search.trim().toLocaleLowerCase("de-DE");
  return choices.filter(choice => choice.name.toLocaleLowerCase("de-DE").includes(query));
}

/** Carry collection areas only; object IDs, draft URLs and query parameters never cross a series boundary. */
export function workspaceSwitchHref(series: WorkspaceChoice, type?: EventType, area?: string) {
  if (area === "settings" && series.canManage) return `/workspaces/${series.id}/settings`;
  const base = workspaceHref(series, type);
  if (!base.endsWith("/quiz")) return base;
  const permitted = ["content", "questions", "stories", "polls", ...(series.canManageQuiz ? ["events", "teams"] : [])];
  return `${base}/${permitted.includes(area ?? "") ? area : series.canManageQuiz ? "events" : "content"}`;
}

export function bindWorkspaceContentParams(paramsKey: string, seriesId: number | undefined, contentType?: string) {
  const params = new URLSearchParams(paramsKey);
  if (seriesId !== undefined) {
    params.set("eventSeriesId", String(seriesId));
    if (contentType) params.set("contentType", contentType);
  }
  return params;
}

/** Only object pages need a readback. Collections and public live views do not. */
export function needsWorkspaceObjectContext(pathname: string) {
  return /^\/quiz\/[1-9]\d*(?:\/(?:slides|auswertung)(?:\/[^?#\\]*)?)?$/.test(pathname) ||
    /^\/(?:content\/(?:questions|story-elements|polls)|fragen\/editor|story-elemente|admin\/eventreihen)\/[1-9]\d*$/.test(pathname);
}
