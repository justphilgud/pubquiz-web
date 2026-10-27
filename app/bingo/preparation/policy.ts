import { isGameId } from "@/app/games/gameDraft";
import { validateCard, type CardLayout } from "../core/cards";

export const ROUND_PAGE_SIZE = 25;
export const CARD_PAGE_SIZE = 50;
export const MAX_GENERATE = 500;
export const MAX_EXPORT = 200;
export type CardStrategy = "NEW" | "EXISTING";
export class BingoPreparationError extends Error {
  constructor(message: string, public readonly field?: string) { super(message); }
}
export const denied = () => new BingoPreparationError("Bingo nicht gefunden oder kein Zugriff. Bitte Rechte und Freischaltung prüfen.");
type Base = { gameId: string; expectedSeriesId: number; revision: number };
export type BingoCommand = Base & (
  | { operation: "createRound" }
  | { operation: "saveRound"; roundId: string; label: string; target: number; strategy: CardStrategy; issued: number | null }
  | { operation: "moveRound"; roundId: string; direction: -1 | 1 }
  | { operation: "removeRound"; roundId: string }
  | { operation: "generate"; roundId: string; count: number; requestId: string }
  | { operation: "attach" | "detach"; roundId: string; seriesId: string }
);
function integer(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new BingoPreparationError(`Bitte eine ganze Zahl von ${min} bis ${max} eingeben.`, field);
  }
  return value;
}
function uuid(value: unknown): string { if (!isGameId(value)) throw denied(); return value; }
export function parseCommand(input: unknown): BingoCommand {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw denied();
  const r = input as Record<string, unknown>;
  const base: Base = { gameId: uuid(r.gameId), expectedSeriesId: integer(r.expectedSeriesId, 1, 2147483647, "series"), revision: integer(r.revision, 0, 2147483646, "revision") };
  let result: BingoCommand;
  switch (r.operation) {
    case "createRound": result = { ...base, operation: r.operation }; break;
    case "saveRound":
      if (typeof r.label !== "string" || !r.label.trim() || r.label.trim().length > 80) throw new BingoPreparationError("Bitte eine Bezeichnung mit 1 bis 80 Zeichen eingeben.", "label");
      if (r.strategy !== "NEW" && r.strategy !== "EXISTING") throw new BingoPreparationError("Bitte eine Kartenstrategie auswählen.", "strategy");
      result = { ...base, operation: r.operation, roundId: uuid(r.roundId), label: r.label.trim(), target: integer(r.target, 1, 75, "target"), strategy: r.strategy, issued: r.issued === null ? null : integer(r.issued, 0, 2147483647, "issued") }; break;
    case "moveRound":
      if (r.direction !== -1 && r.direction !== 1) throw denied();
      result = { ...base, operation: r.operation, roundId: uuid(r.roundId), direction: r.direction }; break;
    case "removeRound": result = { ...base, operation: r.operation, roundId: uuid(r.roundId) }; break;
    case "generate": result = { ...base, operation: r.operation, roundId: uuid(r.roundId), count: integer(r.count, 1, MAX_GENERATE, "count"), requestId: uuid(r.requestId) }; break;
    case "attach": case "detach": result = { ...base, operation: r.operation, roundId: uuid(r.roundId), seriesId: uuid(r.seriesId) }; break;
    default: throw denied();
  }
  if (Object.keys(r).some(key => !Object.hasOwn(result, key))) throw denied();
  return result;
}
export function pageNumber(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) throw new BingoPreparationError("Ungültige Seite.");
  return Number(value);
}
export function cardSearch(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 64 || !/^[a-zA-Z0-9 -]*$/.test(value)) throw new BingoPreparationError("Bitte eine gültige Karten- oder Serienkennung eingeben.");
  return value.trim();
}
export function exportRange(from: unknown, to: unknown, count: number): { from: number; to: number } {
  const parse = (v: unknown) => typeof v === "string" && /^[1-9]\d{0,2}$/.test(v) ? Number(v) : NaN;
  const start = integer(parse(from), 1, count, "from"), end = integer(parse(to), start, count, "to");
  if (end - start + 1 > MAX_EXPORT) throw new BingoPreparationError(`Bitte höchstens ${MAX_EXPORT} Karten je PDF wählen.`);
  return { from: start, to: end };
}
export function decodeCard(value: unknown): CardLayout {
  try { validateCard(value); return value; } catch { throw new BingoPreparationError("Die gespeicherte Karte ist ungültig. Bitte die Administration informieren."); }
}
export type RoundView = { id: string; position: number; label: string; target: number; strategy: CardStrategy; issued: number | null; cardCount: number; series: { id: string; code: string; count: number }[]; history: { actor: string; at: string; before: number | null; after: number | null }[] };
export type SeriesView = { id: string; code: string; count: number; originRoundId: string; createdAt: string; designName: string; olderDesign: boolean };
export type PreparationView = { gameId: string; title: string; seriesId: number; revision: number; archived: boolean; rounds: RoundView[]; roundCount: number; page: number; available: SeriesView[]; seriesPage: number; seriesCount: number };
export type StoredCard = { id: string; code: string; shortCode?: string; ordinal: number; cells: CardLayout };
