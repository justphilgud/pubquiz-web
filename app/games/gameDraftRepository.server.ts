import "server-only";
import type { Prisma, game_drafts } from "@/app/generated/prisma/client";
import { isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { prisma } from "@/app/lib/prisma";
import { getActorPermissions } from "@/app/roles/roleAssignments.server";
import { canAccessGame, GameDraftError, isGameId, parseGameFields, type GameType, type GameDraftView, type GameSeries } from "./gameDraft";

const denied = () => new GameDraftError("Spiel nicht gefunden oder kein Zugriff. Bitte Rechte und Produktfreischaltung prüfen.");
function view(row: game_drafts): GameDraftView {
  return { id: row.id, type: row.eventart as GameType, seriesId: row.eventreihe_id, title: row.titel, date: row.datum?.toISOString().slice(0,10) ?? "", time: row.uhrzeit ?? "", status: "DRAFT", createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
async function gameContext(tx: Prisma.TransactionClient, userId: number, type: GameType) {
  const actor = await getActorPermissions(userId, tx);
  const rows = await tx.eventreihen.findMany({ where: { eventarten: { some: { eventart: type, ist_freigeschaltet: true } } }, select: { eventreihe_id: true, name: true }, orderBy: [{ name: "asc" }, { eventreihe_id: "asc" }] });
  const choices: GameSeries[] = rows.filter(row => canAccessGame(actor, row.eventreihe_id, type, true)).map(row => ({ id: row.eventreihe_id, name: row.name, canWrite: canAccessGame(actor, row.eventreihe_id, type, true, true) }));
  return { actor, choices };
}
export async function gameSeriesForActor(tx: Prisma.TransactionClient, userId: number, type: GameType): Promise<GameSeries[]> { return (await gameContext(tx, userId, type)).choices; }
export async function listGameDrafts(userId: number, type: GameType, seriesId?: number) {
  return prisma.$transaction(async tx => {
    const { actor, choices } = await gameContext(tx, userId, type);
    if (!choices.length && !isAdministrator(actor)) throw denied();
    if (seriesId !== undefined && !choices.some(c => c.id === seriesId)) throw denied();
    const rows = await tx.game_drafts.findMany({ where: { eventart: type, eventreihe_id: { in: choices.filter(c => seriesId === undefined || c.id === seriesId).map(c => c.id) } }, orderBy: [{ updated_at: "desc" }, { id: "asc" }] });
    return { choices, games: rows.map(view) };
  }, { isolationLevel: "RepeatableRead" });
}
export async function readGameDraft(userId: number, type: GameType, id: string) {
  if (!isGameId(id)) throw denied();
  return prisma.$transaction(async tx => {
    const choices = await gameSeriesForActor(tx, userId, type);
    const row = await tx.game_drafts.findFirst({ where: { id, eventart: type, eventreihe_id: { in: choices.map(c => c.id) } } });
    if (!row) throw denied();
    return { choices, game: view(row), canWrite: choices.find(c => c.id === row.eventreihe_id)!.canWrite };
  }, { isolationLevel: "RepeatableRead" });
}
export async function writeGameDraft(userId: number, type: GameType, input: unknown) {
  const data = parseGameFields(input);
  return prisma.$transaction(async tx => {
    if (data.id) await tx.$queryRaw`SELECT id FROM pubquiz.game_drafts WHERE id = ${data.id}::uuid FOR UPDATE`;
    const old = data.id ? await tx.game_drafts.findUnique({ where: { id: data.id } }) : null;
    if (data.id && (!old || old.eventart !== type)) throw denied();
    // Same product gate as existing toggles, deterministic order for reassignment.
    for (const id of [...new Set([data.seriesId, ...(old ? [old.eventreihe_id] : [])])].sort((a,b) => a-b)) await tx.$queryRaw`SELECT pg_advisory_xact_lock(860012, ${id})::text`;
    // Keep active user and current role rows stable until this write commits.
    await tx.$queryRaw`SELECT id FROM pubquiz.users WHERE id = ${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT benutzer_id FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id = ${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT rollenzuweisung_id FROM pubquiz.benutzer_rollenzuweisungen WHERE benutzer_id = ${userId} FOR SHARE`;
    const choices = await gameSeriesForActor(tx, userId, type);
    const canWrite = (id: number) => choices.some(c => c.id === id && c.canWrite);
    if (!canWrite(data.seriesId) || (old && !canWrite(old.eventreihe_id))) throw denied();
    if (old && old.updated_at.toISOString() !== data.updatedAt) throw new GameDraftError("Dieses Spiel wurde inzwischen geändert. Bitte neu laden; deine Eingaben bleiben bis dahin erhalten.");
    const fields = { eventreihe_id: data.seriesId, titel: data.title, datum: data.date ? new Date(`${data.date}T00:00:00.000Z`) : null, uhrzeit: data.time || null };
    const row = old ? await tx.game_drafts.update({ where: { id: old.id }, data: fields }) : await tx.game_drafts.create({ data: { ...fields, eventart: type } });
    return view(row);
  }, { timeout: 15000 });
}
