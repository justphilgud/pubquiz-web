import "server-only";
import { prisma } from "@/app/lib/prisma";
import { isGameId } from "@/app/games/gameDraft";
import { resolveSharedDesign } from "@/app/rendering/sharedDesign/sharedDesignRepository.server";
import { preparationContext as context } from "./access.server";
import { storedCard } from "./readExport.server";
import { designHash, parsePrintSnapshot } from "./printSnapshot";
import { CARD_PAGE_SIZE, ROUND_PAGE_SIZE, denied, type PreparationView } from "./policy";
import { shortCardCode } from "@/app/bingo/preparation/bingoPrint";
import { resolveBingoPrint } from "./printDesign";

export async function readPreparation(userId: number, gameId: string, page = 1, seriesPage = 1): Promise<PreparationView> {
  return prisma.$transaction(async tx => {
    const { game, series } = await context(tx, userId, gameId);
    const prep = await tx.bingo_preparations.findUnique({ where: { game_id: gameId } });
    const rounds = await tx.bingo_rounds.findMany({ where: { game_id: gameId }, orderBy: { position: "asc" }, skip: (page - 1) * ROUND_PAGE_SIZE, take: ROUND_PAGE_SIZE,
      include: { series: { include: { series: { select: { id: true, code: true, card_count: true, origin_round_id: true } } } }, issuance_changes: { orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 20, include: { actor: { select: { name: true } } } } } });
    const available = await tx.bingo_card_series.findMany({ where: { game_id: gameId }, orderBy: [{ created_at: "desc" }, { id: "asc" }], skip: (seriesPage - 1) * ROUND_PAGE_SIZE, take: ROUND_PAGE_SIZE });
    let currentHash: string | null = null;
    try {const d=(await resolveSharedDesign(tx,game.shared_design_template_id,series)).design;d.config.bingoPrint=resolveBingoPrint(d,series.bingo_print_config,game.bingo_print_config);currentHash=designHash(d);} catch { /* Old exports remain usable independently of the current template. */ }
    return { gameId, title: game.titel, seriesId: game.eventreihe_id, revision: prep?.revision ?? 0, archived: series.ist_archiviert,
      page, seriesPage, roundCount: await tx.bingo_rounds.count({ where: { game_id: gameId } }), seriesCount: await tx.bingo_card_series.count({ where: { game_id: gameId } }),
      rounds: rounds.map(r => ({ id: r.id, position: r.position, label: r.label, target: r.planned_draws, strategy: r.strategy as "NEW" | "EXISTING", issued: r.issued_count,
        cardCount: r.series.reduce((n, s) => n + s.series.card_count, 0), series: r.series.map(s => ({ id: s.series_id, code: s.series.code, count: s.series.card_count })),
        history: r.issuance_changes.map(h => ({ actor: h.actor.name ?? "Benutzer", at: h.created_at.toISOString(), before: h.previous_count, after: h.new_count })) })),
      available: available.map(s => { const snapshot = parsePrintSnapshot(s.print_snapshot); return { id: s.id, code: s.code, count: s.card_count, originRoundId: s.origin_round_id, createdAt: s.created_at.toISOString(), designName: snapshot.design.name, olderDesign: snapshot.designHash !== currentHash }; }) };
  }, { isolationLevel: "RepeatableRead" });
}

export async function readCards(userId: number, gameId: string, seriesId: string, page = 1, search = "", version=1) {
  if (!isGameId(seriesId)) throw denied();
  return prisma.$transaction(async tx => {
    await context(tx, userId, gameId);
    const series = await tx.bingo_card_series.findFirst({ where: { id: seriesId, game_id: gameId },include:{short_label:true,print_versions:{orderBy:{version:'desc'},select:{version:true,created_at:true,actor:{select:{name:true}}}}} });
    if (!series) throw denied();
    const ordinals=series.short_label?Array.from({length:series.card_count},(_,i)=>i+1).filter(n=>shortCardCode(series.short_label!.prefix,n).toLowerCase().includes(search.toLowerCase())):[];
    const where = { series_id: series.id,OR:[{printed_code:{contains:search,mode:'insensitive' as const}},{ordinal:{in:ordinals}}] };
    const rows = await tx.bingo_cards.findMany({ where, orderBy: { ordinal: "asc" }, skip: (page - 1) * CARD_PAGE_SIZE, take: CARD_PAGE_SIZE });
    if(!Number.isSafeInteger(version)||version<1)throw denied();const historical=version===1?null:await tx.bingo_print_versions.findUnique({where:{series_id_version:{series_id:series.id,version}},select:{snapshot:true}});if(version!==1&&!historical)throw denied();
    return {code:series.code,count:await tx.bingo_cards.count({where}),total:series.card_count,version,versions:[{version:1,at:series.created_at.toISOString(),actor:'Ursprüngliche Erzeugung'},...series.print_versions.map(v=>({version:v.version,at:v.created_at.toISOString(),actor:v.actor.name??'Benutzer'}))],snapshot:parsePrintSnapshot(historical?.snapshot??series.print_snapshot),cards:rows.map(r=>({...storedCard(r),shortCode:series.short_label?shortCardCode(series.short_label.prefix,r.ordinal):undefined}))};
  }, { isolationLevel: "RepeatableRead" });
}
