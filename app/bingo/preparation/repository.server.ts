import "server-only";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { isGameId } from "@/app/games/gameDraft";
import { resolveSharedDesign } from "@/app/rendering/sharedDesign/sharedDesignRepository.server";
import { generateCard } from "../core/cards";
import { preparationContext as context } from "./access.server";
import { storedCard } from "./readExport.server";
export { readExport } from "./readExport.server";
import { capturePrintSnapshot } from "./printAssets.server";
import { canonical, designHash, parsePrintSnapshot, sha256 } from "./printSnapshot";
import { BingoPreparationError, CARD_PAGE_SIZE, ROUND_PAGE_SIZE, denied, parseCommand, type PreparationView } from "./policy";

export async function readPreparation(userId: number, gameId: string, page = 1, seriesPage = 1): Promise<PreparationView> {
  return prisma.$transaction(async tx => {
    const { game, series } = await context(tx, userId, gameId);
    const prep = await tx.bingo_preparations.findUnique({ where: { game_id: gameId } });
    const rounds = await tx.bingo_rounds.findMany({ where: { game_id: gameId }, orderBy: { position: "asc" }, skip: (page - 1) * ROUND_PAGE_SIZE, take: ROUND_PAGE_SIZE,
      include: { series: { include: { series: { select: { id: true, code: true, card_count: true, origin_round_id: true } } } }, issuance_changes: { orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 20, include: { actor: { select: { name: true } } } } } });
    const available = await tx.bingo_card_series.findMany({ where: { game_id: gameId }, orderBy: [{ created_at: "desc" }, { id: "asc" }], skip: (seriesPage - 1) * ROUND_PAGE_SIZE, take: ROUND_PAGE_SIZE });
    let currentHash: string | null = null;
    try { currentHash = designHash((await resolveSharedDesign(tx, game.shared_design_template_id, series)).design); } catch { /* Old exports remain usable independently of the current template. */ }
    return { gameId, title: game.titel, seriesId: game.eventreihe_id, revision: prep?.revision ?? 0, archived: series.ist_archiviert,
      page, seriesPage, roundCount: await tx.bingo_rounds.count({ where: { game_id: gameId } }), seriesCount: await tx.bingo_card_series.count({ where: { game_id: gameId } }),
      rounds: rounds.map(r => ({ id: r.id, position: r.position, label: r.label, target: r.planned_draws, strategy: r.strategy as "NEW" | "EXISTING", issued: r.issued_count,
        cardCount: r.series.reduce((n, s) => n + s.series.card_count, 0), series: r.series.map(s => ({ id: s.series_id, code: s.series.code, count: s.series.card_count })),
        history: r.issuance_changes.map(h => ({ actor: h.actor.name ?? "Benutzer", at: h.created_at.toISOString(), before: h.previous_count, after: h.new_count })) })),
      available: available.map(s => { const snapshot = parsePrintSnapshot(s.print_snapshot); return { id: s.id, code: s.code, count: s.card_count, originRoundId: s.origin_round_id, createdAt: s.created_at.toISOString(), designName: snapshot.design.name, olderDesign: snapshot.designHash !== currentHash }; }) };
  }, { isolationLevel: "RepeatableRead" });
}

export async function writePreparation(userId: number, input: unknown) {
  const command = parseCommand(input);
  return prisma.$transaction(async tx => {
    const { game, series } = await context(tx, userId, command.gameId, true);
    if (game.eventreihe_id !== command.expectedSeriesId) throw new BingoPreparationError("Die Eventreihe wurde inzwischen geändert. Bitte neu laden; deine Eingaben bleiben erhalten.");
    const requestHash = sha256(canonical(command));
    if (command.operation === "generate") {
      const existing = await tx.bingo_card_series.findUnique({ where: { game_id_request_id: { game_id: game.id, request_id: command.requestId } } });
      if (existing) {
        if (existing.request_hash !== requestHash) throw new BingoPreparationError("Diese Erzeugungsanfrage wurde bereits mit anderen Angaben verwendet.");
        return { seriesId: existing.id, repeated: true };
      }
    }
    const prep = await tx.bingo_preparations.upsert({ where: { game_id: game.id }, create: { game_id: game.id }, update: {} });
    if (prep.revision !== command.revision) throw new BingoPreparationError("Die Vorbereitung wurde inzwischen geändert. Bitte neu laden; deine Eingaben bleiben erhalten.");
    const round = "roundId" in command ? await tx.bingo_rounds.findFirst({ where: { id: command.roundId, game_id: game.id }, include: { series: { include: { series: { select: { id: true, code: true, card_count: true, origin_round_id: true } } } } } }) : null;
    if ("roundId" in command && !round) throw denied();
    let result: { seriesId?: string; repeated?: boolean } = {};
    switch (command.operation) {
      case "createRound": {
        const max = (await tx.bingo_rounds.aggregate({ where: { game_id: game.id }, _max: { position: true } }))._max.position ?? 0;
        await tx.bingo_rounds.create({ data: { id: randomUUID(), game_id: game.id, position: max + 1, label: `Runde ${max + 1}` } }); break;
      }
      case "saveRound": {
        if (command.strategy === "NEW" && round!.series.some(s => s.series.origin_round_id !== round!.id)) throw new BingoPreparationError("Für neue Karten zuerst die ausdrücklich zugeordneten fremden Serien entfernen.", "strategy");
        const count = round!.series.reduce((n, s) => n + s.series.card_count, 0);
        if (command.issued !== null && command.issued > count) throw new BingoPreparationError(`Es sind nur ${count} unterschiedliche Karten zugeordnet.`, "issued");
        await tx.bingo_rounds.update({ where: { id: round!.id }, data: { label: command.label, planned_draws: command.target, strategy: command.strategy, issued_count: command.issued } });
        if (round!.issued_count !== command.issued) await tx.bingo_issuance_changes.create({ data: { id: randomUUID(), round_id: round!.id, actor_id: userId, previous_count: round!.issued_count, new_count: command.issued } });
        break;
      }
      case "moveRound": {
        const adjacent = await tx.bingo_rounds.findFirst({ where: { game_id: game.id, position: command.direction === -1 ? { lt: round!.position } : { gt: round!.position } }, orderBy: { position: command.direction === -1 ? "desc" : "asc" } });
        if (!adjacent) throw new BingoPreparationError("Die Runde kann nicht weiter verschoben werden.");
        const max = (await tx.bingo_rounds.aggregate({ where: { game_id: game.id }, _max: { position: true } }))._max.position!;
        await tx.bingo_rounds.update({ where: { id: round!.id }, data: { position: max + 1 } });
        await tx.bingo_rounds.update({ where: { id: adjacent.id }, data: { position: round!.position } });
        await tx.bingo_rounds.update({ where: { id: round!.id }, data: { position: adjacent.position } }); break;
      }
      case "removeRound": {
        if (round!.series.length || round!.issued_count !== null || await tx.bingo_card_series.count({ where: { origin_round_id: round!.id } }) || await tx.bingo_issuance_changes.count({ where: { round_id: round!.id } })) throw new BingoPreparationError("Runden mit Karten, Ausgabeangaben oder Historie können nicht gelöscht werden.");
        await tx.bingo_rounds.delete({ where: { id: round!.id } }); break;
      }
      case "attach": case "detach": {
        const selected = await tx.bingo_card_series.findFirst({ where: { id: command.seriesId, game_id: game.id } });
        if (!selected) throw denied();
        if (command.operation === "attach") {
          if (round!.strategy === "NEW" && selected.origin_round_id !== round!.id) throw new BingoPreparationError("Bitte zuerst „Vorhandene Karten verwenden“ auswählen.");
          await tx.bingo_round_series.upsert({ where: { round_id_series_id: { round_id: round!.id, series_id: selected.id } }, create: { round_id: round!.id, series_id: selected.id, game_id: game.id }, update: {} });
        } else {
          const remaining = round!.series.filter(s => s.series_id !== selected.id).reduce((n, s) => n + s.series.card_count, 0);
          if (round!.issued_count !== null && round!.issued_count > remaining) throw new BingoPreparationError("Die ausgegebene Gesamtmenge ist höher als die verbleibende Kartenmenge. Bitte zuerst die Ausgabeangabe korrigieren.");
          await tx.bingo_round_series.delete({ where: { round_id_series_id: { round_id: round!.id, series_id: selected.id } } });
        } break;
      }
      case "generate": {
        if (round!.strategy !== "NEW") throw new BingoPreparationError("Diese Runde verwendet vorhandene Karten. Bitte eine Serie ausdrücklich zuordnen.");
        const design = (await resolveSharedDesign(tx, game.shared_design_template_id, series)).design;
        const snapshot = await capturePrintSnapshot(design, game.titel, round!.label);
        const seriesId = randomUUID(), code = `BG-${randomBytes(6).toString("hex").toUpperCase()}`, hashes = new Set<string>();
        const cards: Prisma.bingo_cardsCreateManyInput[] = [];
        for (let attempt = 0; cards.length < command.count && attempt < command.count * 20; attempt++) {
          const card = generateCard(randomUUID(), () => randomInt(0x100000000) / 0x100000000), hash = sha256(canonical(card.cells));
          if (hashes.has(hash)) continue;
          hashes.add(hash); const ordinal = cards.length + 1;
          cards.push({ id: card.id, series_id: seriesId, ordinal, printed_code: `${code}-${String(ordinal).padStart(4, "0")}`, cells: card.cells as Prisma.InputJsonValue, layout_hash: hash });
        }
        if (cards.length !== command.count) throw new BingoPreparationError("Es konnten nicht genug unterschiedliche Karten erzeugt werden. Es wurde keine Serie gespeichert.");
        await tx.bingo_card_series.create({ data: { id: seriesId, game_id: game.id, origin_round_id: round!.id, code, card_count: command.count, request_id: command.requestId, request_hash: requestHash, print_snapshot: snapshot as unknown as Prisma.InputJsonValue, created_by: userId } });
        await tx.bingo_cards.createMany({ data: cards });
        await tx.bingo_round_series.create({ data: { game_id: game.id, round_id: round!.id, series_id: seriesId } });
        result = { seriesId, repeated: false }; break;
      }
    }
    await tx.bingo_preparations.update({ where: { game_id: game.id }, data: { revision: { increment: 1 } } });
    return result;
  }, { timeout: 30000 });
}

export async function readCards(userId: number, gameId: string, seriesId: string, page = 1, search = "") {
  if (!isGameId(seriesId)) throw denied();
  return prisma.$transaction(async tx => {
    await context(tx, userId, gameId);
    const series = await tx.bingo_card_series.findFirst({ where: { id: seriesId, game_id: gameId } });
    if (!series) throw denied();
    const where = { series_id: series.id, printed_code: { contains: search, mode: "insensitive" as const } };
    const rows = await tx.bingo_cards.findMany({ where, orderBy: { ordinal: "asc" }, skip: (page - 1) * CARD_PAGE_SIZE, take: CARD_PAGE_SIZE });
    return { code: series.code, count: await tx.bingo_cards.count({ where }), total: series.card_count, snapshot: parsePrintSnapshot(series.print_snapshot), cards: rows.map(storedCard) };
  }, { isolationLevel: "RepeatableRead" });
}
