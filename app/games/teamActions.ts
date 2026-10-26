"use server";
import { requireActor } from "@/app/lib/permissions";
import { GameDraftError, isGameType } from "./gameDraft";
import { readGameTeams, changeGameTeam } from "./gameTeamsRepository.server";
import type { GameTeamsView } from "./gameTeams";
export type GameTeamsResult = { success: true; data: GameTeamsView } | { success: false; message: string };
export async function gameTeamsAction(type: unknown, id: unknown, search: unknown): Promise<GameTeamsResult> {
  const { actor } = await requireActor();
  if (!isGameType(type) || typeof id !== "string") return { success: false, message: "Ungültige Spiel-ID oder Eventart." };
  try { return { success: true, data: await readGameTeams(actor.userId,type,id,search) }; } catch (e) { return failure(e); }
}
export async function changeGameTeamAction(type: unknown, input: unknown): Promise<GameTeamsResult> {
  const { actor } = await requireActor();
  if (!isGameType(type)) return { success: false, message: "Ungültige Eventart." };
  try { return { success: true, data: await changeGameTeam(actor.userId,type,input) }; } catch (e) { return failure(e); }
}
function failure(e: unknown): GameTeamsResult { return { success: false, message: e instanceof GameDraftError ? e.message : "Die Teamzuordnung konnte nicht geladen oder geändert werden. Bitte erneut versuchen." }; }
