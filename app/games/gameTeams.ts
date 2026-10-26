import type { TeamAvatarCode } from "@/app/teams/teamProfile";
import { GameDraftError, isGameId } from "./gameDraft";

export type AssignmentTeam = { id: number; name: string; avatar: TeamAvatarCode; archived: boolean };
export type GameTeamAssignment = { id: string; createdAt: string; team: AssignmentTeam };
export type GameTeamsView = { assigned: GameTeamAssignment[]; candidates: AssignmentTeam[]; hasMore: boolean; canWrite: boolean; canAdd: boolean; hasTeamScope: boolean };
export type GameTeamCommand = { gameId: string; seriesId: number; updatedAt: string; operation: "ADD" | "REMOVE"; teamId?: number; assignmentId?: string };
export function parseGameTeamCommand(value: unknown): GameTeamCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new GameDraftError("Ungültige Teamzuordnung.");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !["gameId", "seriesId", "updatedAt", "operation", "teamId", "assignmentId"].includes(k)) || !isGameId(v.gameId) || !Number.isSafeInteger(v.seriesId) || Number(v.seriesId) <= 0 || typeof v.updatedAt !== "string" || !Number.isFinite(Date.parse(v.updatedAt))) throw new GameDraftError("Ungültige Teamzuordnung.");
  if (v.operation === "ADD" && Number.isSafeInteger(v.teamId) && Number(v.teamId) > 0 && v.assignmentId === undefined) return { gameId: v.gameId, seriesId: Number(v.seriesId), updatedAt: v.updatedAt, operation: "ADD", teamId: Number(v.teamId) };
  if (v.operation === "REMOVE" && isGameId(v.assignmentId) && v.teamId === undefined) return { gameId: v.gameId, seriesId: Number(v.seriesId), updatedAt: v.updatedAt, operation: "REMOVE", assignmentId: v.assignmentId as string };
  throw new GameDraftError("Ungültige Teamzuordnung.");
}
export function parseTeamSearch(value: unknown): string {
  if (typeof value !== "string" || value.length > 150) throw new GameDraftError("Bitte höchstens 150 Zeichen für die Teamsuche eingeben.");
  return value.trim();
}
