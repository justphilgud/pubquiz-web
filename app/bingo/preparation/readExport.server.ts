import "server-only";
import { prisma } from "@/app/lib/prisma";
import { isGameId } from "@/app/games/gameDraft";
import { preparationContext } from "./access.server";
import { canonical, parsePrintSnapshot, sha256 } from "./printSnapshot";
import { BingoPreparationError, denied, decodeCard, MAX_EXPORT, type StoredCard } from "./policy";

export function storedCard(row: { id: string; printed_code: string; ordinal: number; cells: unknown; layout_hash: string }): StoredCard {
  const cells = decodeCard(row.cells);
  if (sha256(canonical(cells)) !== row.layout_hash) throw new BingoPreparationError("Die gespeicherte Karte besteht die Integritätsprüfung nicht.");
  return { id: row.id, code: row.printed_code, ordinal: row.ordinal, cells };
}

/** This module deliberately has no dependency on generation or source-asset IO. */
export async function readExport(userId: number, gameId: string, seriesId: string, from: number, to: number) {
  if (!isGameId(seriesId)) throw denied();
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await preparationContext(tx, userId, gameId);
    const series = await tx.bingo_card_series.findFirst({ where: { id: seriesId, game_id: gameId } });
    if (!series) throw denied();
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > series.card_count || to - from + 1 > MAX_EXPORT) throw new BingoPreparationError("Ungültiger PDF-Bereich; höchstens 200 Karten je PDF.");
    const rows = await tx.bingo_cards.findMany({ where: { series_id: series.id, ordinal: { gte: from, lte: to } }, orderBy: { ordinal: "asc" } });
    if (rows.length !== to - from + 1) throw new BingoPreparationError("Die gespeicherte Kartenserie ist unvollständig.");
    return { code: series.code, snapshot: parsePrintSnapshot(series.print_snapshot), cards: rows.map(storedCard) };
  }, { isolationLevel: "RepeatableRead" });
}
