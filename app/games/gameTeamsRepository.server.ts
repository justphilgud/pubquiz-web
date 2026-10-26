import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { getActorPermissions } from "@/app/roles/roleAssignments.server";
import { canAccessTeamManagement } from "@/app/teams/teamManagementPolicy";
import { teamScopeWhere } from "@/app/teams/teamManagement.server";
import { resolveTeamAvatarCode } from "@/app/teams/teamProfile";
import { GameDraftError, isGameId, type GameType } from "./gameDraft";
import { gameSeriesForActor } from "./gameDraftRepository.server";
import { parseGameTeamCommand, parseTeamSearch, type GameTeamsView, type AssignmentTeam } from "./gameTeams";

const denied = () => new GameDraftError("Spiel oder Teamzuordnung nicht gefunden oder kein Zugriff.");
const teamSelect = { team_id: true, teamname: true, avatar_code: true, ist_archiviert: true } as const;
function teamView(t: { team_id: number; teamname: string; avatar_code: string | null; ist_archiviert: boolean }): AssignmentTeam {
  return { id: t.team_id, name: t.teamname, avatar: resolveTeamAvatarCode(t.team_id, t.avatar_code), archived: t.ist_archiviert };
}
async function context(tx: Prisma.TransactionClient, userId: number, type: GameType, id: string) {
  const choices = await gameSeriesForActor(tx, userId, type);
  const game = await tx.game_drafts.findFirst({ where: { id, eventart: type, eventreihe_id: { in: choices.map(c => c.id) } } });
  if (!game) throw denied();
  return { game, choice: choices.find(c => c.id === game.eventreihe_id)!, actor: await getActorPermissions(userId, tx) };
}
async function load(tx: Prisma.TransactionClient, userId: number, type: GameType, id: string, search: string): Promise<GameTeamsView> {
  const { choice, actor } = await context(tx, userId, type, id);
  const assigned = await tx.game_team_assignments.findMany({ where: { game_id: id }, orderBy: [{ created_at: "asc" }, { id: "asc" }], select: { id: true, created_at: true, team: { select: teamSelect } } });
  const hasTeamScope = canAccessTeamManagement(actor);
  const candidates = choice.canCreate && hasTeamScope ? await tx.teams.findMany({ where: { ...teamScopeWhere(actor), ist_archiviert: false, game_team_assignments: { none: { game_id: id } }, ...(search ? { teamname: { contains: search, mode: "insensitive" } } : {}) }, select: teamSelect, orderBy: [{ teamname: "asc" }, { team_id: "asc" }], take: 51 }) : [];
  return { assigned: assigned.map(a => ({ id: a.id, createdAt: a.created_at.toISOString(), team: teamView(a.team) })), candidates: candidates.slice(0,50).map(teamView), hasMore: candidates.length > 50, canWrite: choice.canWrite, canAdd: choice.canCreate, hasTeamScope };
}
export async function readGameTeams(userId: number, type: GameType, id: string, search: unknown = "") {
  if (!isGameId(id)) throw denied();
  const query = parseTeamSearch(search);
  return prisma.$transaction(tx => load(tx,userId,type,id,query), { isolationLevel: "RepeatableRead" });
}
export async function changeGameTeam(userId: number, type: GameType, input: unknown) {
  const data = parseGameTeamCommand(input);
  return prisma.$transaction(async tx => {
    // Same first lock as master-data writes: assignment and reassignment cannot race.
    await tx.$queryRaw`SELECT id FROM pubquiz.game_drafts WHERE id=${data.gameId}::uuid FOR UPDATE`;
    const game = await tx.game_drafts.findUnique({ where: { id: data.gameId } });
    if (!game || game.eventart !== type) throw denied();
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(860012, ${game.eventreihe_id})::text`;
    await tx.$queryRaw`SELECT eventreihe_id FROM pubquiz.eventreihen WHERE eventreihe_id=${game.eventreihe_id} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM pubquiz.users WHERE id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT benutzer_id FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT rollenzuweisung_id FROM pubquiz.benutzer_rollenzuweisungen WHERE benutzer_id=${userId} FOR SHARE`;
    const { choice, actor } = await context(tx,userId,type,data.gameId);
    if (!choice.canWrite) throw denied();
    if (game.eventreihe_id !== data.seriesId || game.updated_at.toISOString() !== data.updatedAt) throw new GameDraftError("Die Spielstammdaten wurden inzwischen geändert. Bitte neu laden.");
    if (data.operation === "ADD") {
      if (!choice.canCreate || !canAccessTeamManagement(actor)) throw new GameDraftError("Keine auswählbaren Teams oder die Eventreihe ist archiviert.");
      await tx.$queryRaw`SELECT team_id FROM pubquiz.teams WHERE team_id=${data.teamId!} FOR SHARE`;
      const team = await tx.teams.findFirst({ where: { team_id: data.teamId, ist_archiviert: false, ...teamScopeWhere(actor) }, select: { team_id: true } });
      if (!team) throw denied();
      await tx.game_team_assignments.upsert({ where: { game_id_team_id: { game_id: game.id, team_id: team.team_id } }, create: { game_id: game.id, team_id: team.team_id }, update: {} });
    } else {
      const assignment = await tx.game_team_assignments.findUnique({ where: { id: data.assignmentId } });
      if (!assignment || assignment.game_id !== game.id) throw denied();
      await tx.game_team_assignments.delete({ where: { id: assignment.id } });
    }
    // Membership has its own persistence: never write master fields or their version.
    return load(tx,userId,type,game.id,"");
  }, { timeout: 15000 });
}
