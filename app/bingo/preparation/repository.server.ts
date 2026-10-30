import "server-only";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { resolveSharedDesign } from "@/app/rendering/sharedDesign/sharedDesignRepository.server";
import { generateCard } from "../core/cards";
import { preparationContext as context } from "./access.server";
export { readExport } from "./readExport.server";
export { readPreparation, readCards } from "./readPreparation.server";
import { capturePrintSnapshot } from "./printAssets.server";
import { canonical, sha256 } from "./printSnapshot";
import { BingoPreparationError, denied, parseCommand } from "./policy";
import { resolveBingoPrint } from "./printDesign";

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
    if(round&&(await tx.$queryRaw<{present:string|null}[]>`SELECT to_regclass('pubquiz.bingo_event_rounds')::text present`)[0].present){
      if((await tx.$queryRaw<{round_id:string}[]>`SELECT f.round_id FROM pubquiz.bingo_event_rounds f JOIN pubquiz.bingo_live_runs r ON r.id=f.run_id WHERE f.round_id=${round.id}::uuid AND f.game_id=${game.id}::uuid AND r.status IN ('RUNNING','PAUSED') LIMIT 1`).length)throw new BingoPreparationError("Diese Runde wurde bereits gestartet. Karten, Planung und Historie bleiben unverändert.");
    }
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
        const snapshot = await capturePrintSnapshot(design, game.titel, round!.label,resolveBingoPrint(design,series.bingo_print_config,game.bingo_print_config));
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

