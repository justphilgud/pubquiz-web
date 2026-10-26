import { canAccessTeamManagement } from "@/app/teams/teamManagementPolicy";
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


/** Stable catalog for the whole actor, never a menu derived from one selected row. */
export function getNavigationCapabilities(actor: AuthorizationActor, choices: readonly WorkspaceChoice[]) {
  const admin = isAdministrator(actor);
  return {
    content: canAccessCrossSeriesContent(actor),
    quizzes: admin || choices.some(choice => choice.canManageQuiz),
    bingo: admin || choices.some(choice => choice.eventTypes.includes("BINGO")),
    karaoke: admin || choices.some(choice => choice.eventTypes.includes("POWERPOINT_KARAOKE")),
    teams: canAccessTeamManagement(actor),
    templates: admin,
    series: admin || choices.length > 0,
    admin,
  };
}
export type NavigationCapabilities = ReturnType<typeof getNavigationCapabilities>;
export function activeNavigationSection(path: string) {
  if (/^\/admin\/teams(?:\/|$)/.test(path) || /^\/workspaces\/\d+\/quiz\/teams$/.test(path)) return "Teams";
  if (/^\/templates(?:\/|$)/.test(path)) return "Templates";
  if (/^\/admin\/eventreihen(?:\/|$)/.test(path) || /^\/workspaces\/\d+\/settings$/.test(path)) return "Eventreihen";
  if (/^\/(?:bingo|workspaces\/\d+\/bingo)(?:\/|$)/.test(path)) return "Bingo";
  if (/^\/(?:karaoke|workspaces\/\d+\/karaoke)(?:\/|$)/.test(path)) return "PowerPoint-Karaoke";
  if (/^\/(?:content|fragen|story-elemente|quiz|workspaces\/\d+\/quiz)(?:\/|$)/.test(path)) return "Quiz";
  return path.startsWith("/admin/") ? "Administration" : undefined;
}
/** Return targets are collections only: no external redirects or unrelated object IDs. */
export function quizCollectionReturnHref(value: string | null | undefined, seriesId: number) {
  const fallback = `/quiz?series=${seriesId}`;
  if (!value || value.length > 5000 || /[\\\r\n]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://navigation.invalid");
    if (url.origin !== "https://navigation.invalid" || (url.pathname !== "/quiz" && url.pathname !== `/workspaces/${seriesId}/quiz/events`)) return fallback;
    const filters = new URLSearchParams();
    for (const [key, value] of url.searchParams) if (["series", "status", "tab", "q"].includes(key)) filters.append(key, value);
    return url.pathname + (filters.size ? `?${filters}` : "");
  } catch { return fallback; }
}

/** Only collection filters can cross contexts; discard object/draft/return identifiers. */
export function workspaceCollectionHref(seriesId: number | null, type: "quiz" | "bingo" | "karaoke", area: string | undefined, search: string) {
  const allowed = type !== "quiz" ? [] : area === "events" ? ["status", "tab"] : area === "teams" ? ["q", "status"] : ["q", "contentType", "template", "categoryId", "storyType", "status", "questionLifecycle", "media", "usage"];
  const query = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(search)) if (allowed.includes(key)) query.append(key, value);
  const path = seriesId === null ? type !== "quiz" ? `/${type}` : area === "events" ? "/quiz" : area === "teams" ? "/admin/teams" : "/content" : `/workspaces/${seriesId}/${type}${area ? `/${area}` : ""}`;
  if (seriesId === null && type === "quiz" && ["questions", "stories", "polls"].includes(area ?? "")) query.set("contentType", area === "questions" ? "QUESTION" : area === "stories" ? "STORY_ELEMENT" : "POLL");
  return path + (query.size ? `?${query}` : "");
}
export function teamCollectionReturnHref(value: string | null | undefined) {
  if (!value || value.length > 5000 || /[\\\r\n]/.test(value)) return "/admin/teams";
  try {
    const url = new URL(value, "https://navigation.invalid");
    if (url.origin !== "https://navigation.invalid" || (url.pathname !== "/admin/teams" && !/^\/workspaces\/[1-9]\d*\/quiz\/teams$/.test(url.pathname))) return "/admin/teams";
    const filters = new URLSearchParams();
    for (const [key, value] of url.searchParams) if (["q", "status", "eventSeriesId"].includes(key)) filters.append(key, value);
    return url.pathname + (filters.size ? `?${filters}` : "");
  } catch { return "/admin/teams"; }
}
