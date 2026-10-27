import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { gameSeriesForActor } from "@/app/games/gameDraftRepository.server";
import { isGameId } from "@/app/games/gameDraft";
import { BingoPreparationError, denied } from "./policy";

/** Shared fresh authorization and lock order for reads, exports and writes. */
export async function preparationContext(tx: Prisma.TransactionClient, userId: number, gameId: string, write = false) {
  if (!isGameId(gameId)) throw denied();
  if (write) await tx.$queryRaw`SELECT id FROM pubquiz.game_drafts WHERE id=${gameId}::uuid FOR UPDATE`;
  const game = await tx.game_drafts.findUnique({ where: { id: gameId } });
  if (!game || game.eventart !== "BINGO") throw denied();
  if (write) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(860012, ${game.eventreihe_id})::text`;
    await tx.$queryRaw`SELECT eventreihe_id FROM pubquiz.eventreihen WHERE eventreihe_id=${game.eventreihe_id} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM pubquiz.users WHERE id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT benutzer_id FROM pubquiz.benutzer_reihenrollen WHERE benutzer_id=${userId} FOR SHARE`;
    await tx.$queryRaw`SELECT rollenzuweisung_id FROM pubquiz.benutzer_rollenzuweisungen WHERE benutzer_id=${userId} FOR SHARE`;
  }
  const choices = await gameSeriesForActor(tx, userId, "BINGO");
  if (!choices.some(c => c.id === game.eventreihe_id && c.canWrite)) throw denied();
  const series = await tx.eventreihen.findUniqueOrThrow({ where: { eventreihe_id: game.eventreihe_id } });
  if (write && series.ist_archiviert) throw new BingoPreparationError("Archivierte Eventreihen können nicht verändert werden. Vorhandene Karten können weiterhin exportiert werden.");
  return { game, series };
}
