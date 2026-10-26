import { hasEventTypeAccess, type AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";

export type GameType = "BINGO" | "POWERPOINT_KARAOKE";
export const gameTypeInfo = { BINGO: { label: "Bingo", path: "/bingo" }, POWERPOINT_KARAOKE: { label: "PowerPoint-Karaoke", path: "/karaoke" } } as const;
export function isGameType(value: unknown): value is GameType { return value === "BINGO" || value === "POWERPOINT_KARAOKE"; }
export function isGameId(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export class GameDraftError extends Error {}
export type GameDraftFields = { seriesId: number; title: string; date: string; time: string };
export type GameDraftView = GameDraftFields & { id: string; type: GameType; status: "DRAFT"; createdAt: string; updatedAt: string };
export type GameSeries = { id: number; name: string; canWrite: boolean };
export function canAccessGame(actor: AuthorizationActor, seriesId: number, type: GameType, enabled: boolean, write = false) {
  return enabled && hasEventTypeAccess(actor, seriesId, type, write ? "EVENT_MANAGER" : "EDITOR");
}
export function parseGameFields(input: unknown): GameDraftFields & { id?: string; updatedAt?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new GameDraftError("Ungültige Spieldaten.");
  const row = input as Record<string, unknown>;
  if (Object.keys(row).some(key => !["id", "seriesId", "title", "date", "time", "updatedAt"].includes(key))) throw new GameDraftError("Ungültige Spieldaten.");
  if (!Number.isSafeInteger(row.seriesId) || Number(row.seriesId) <= 0) throw new GameDraftError("Bitte eine erlaubte Eventreihe auswählen.");
  if (typeof row.title !== "string" || !row.title.trim() || row.title.trim().length > 150) throw new GameDraftError("Bitte einen Titel mit 1 bis 150 Zeichen eingeben.");
  if (typeof row.date !== "string" || typeof row.time !== "string") throw new GameDraftError("Datum und Uhrzeit sind ungültig.");
  if (row.date && (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.date < "0001-01-01" || row.date > "9999-12-31" || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0,10) !== row.date)) throw new GameDraftError("Bitte ein gültiges Datum eingeben.");
  if (row.time && (!row.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time))) throw new GameDraftError("Bitte eine gültige Uhrzeit und ein Datum eingeben.");
  if (row.id !== undefined && !isGameId(row.id)) throw new GameDraftError("Ungültige Spiel-ID.");
  if (row.id !== undefined && (typeof row.updatedAt !== "string" || !Number.isFinite(Date.parse(row.updatedAt)))) throw new GameDraftError("Bitte das Spiel neu laden.");
  return { seriesId: Number(row.seriesId), title: row.title.trim(), date: row.date, time: row.time, ...(row.id ? { id: row.id as string, updatedAt: row.updatedAt as string } : {}) };
}
/** Collection return links only; no user-provided origins or object routes. */
export function gameReturnHref(type: GameType, value?: string) {
  const path = gameTypeInfo[type].path;
  return value && new RegExp(`^${path}(?:\\?series=[1-9]\\d*)?$`).test(value) ? value : path;
}
