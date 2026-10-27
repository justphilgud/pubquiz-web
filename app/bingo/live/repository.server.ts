import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { preparationContext } from "../preparation/access.server";
import { canonical, sha256 } from "../preparation/printSnapshot";
import { decodeCard } from "../preparation/policy";
import { shortCardCode } from "../preparation/bingoPrint";
import { resolveSharedDesign } from "@/app/rendering/sharedDesign/sharedDesignRepository.server";
import { parseSharedDesign, type SharedDesign } from "@/app/rendering/sharedDesign/sharedDesign";
import { activeElapsedMs } from "../core/run";
import { applyLiveEvent, assertUuid, initialState, parseLiveCommand, replayLive, type FrozenRound, type LiveCommand, type LiveEvent } from "./live";

type Tx = Prisma.TransactionClient;
type RunRow = { id: string; game_id: string; round_id: string; eventreihe_id: number; status: string; revision: number;
  started_at: Date; round_snapshot: FrozenRound; design_snapshot: SharedDesign; audience_key: string; start_request_hash: string };
type EventRow = { request_id: string; request_hash: string; revision: number; actor_id: number; occurred_at: Date; command: unknown };
type CardRow = { id: string; cells: unknown; printed_code: string; ordinal: number; prefix: number };
function fail(code: string): never { throw Error(code); }
function integer(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail("INVALID_REVISION");
}
async function now(tx: Tx): Promise<number> {
  const [row] = await tx.$queryRaw<{ at: Date }[]>`SELECT clock_timestamp()::timestamptz(3) AS at`;
  return row.at.getTime();
}
function frozen(row: RunRow): FrozenRound {
  const r = row.round_snapshot;
  if (!r || Object.keys(r).sort().join() !== "id,issued,label,seriesIds,target" || r.id !== row.round_id ||
      typeof r.label !== "string" || !r.label.trim() || r.label.length > 80 ||
      !Number.isInteger(r.target) || r.target < 1 || r.target > 75 ||
      (r.issued !== null && (!Number.isSafeInteger(r.issued) || r.issued < 0)) ||
      !Array.isArray(r.seriesIds) || !r.seriesIds.length || new Set(r.seriesIds).size !== r.seriesIds.length) fail("INVALID_FROZEN_ROUND");
  r.seriesIds.forEach(assertUuid);
  return r;
}
async function load(tx: Tx, row: RunRow) {
  const cards = await tx.$queryRaw<CardRow[]>`SELECT c.id,c.cells,c.printed_code,c.ordinal,l.prefix
    FROM pubquiz.bingo_live_cards rc JOIN pubquiz.bingo_cards c ON c.id=rc.card_id
    JOIN pubquiz.bingo_card_series s ON s.id=c.series_id
    JOIN pubquiz.bingo_series_labels l ON l.series_id=s.id
    WHERE rc.run_id=${row.id}::uuid AND s.game_id=${row.game_id}::uuid ORDER BY c.id`;
  if (!cards.length) fail("INVALID_FROZEN_CARDS");
  const stored = cards.map(c => ({ id: c.id, cells: decodeCard(c.cells), code: c.printed_code, shortCode: shortCardCode(c.prefix, c.ordinal) }));
  const rows = await tx.$queryRaw<EventRow[]>`SELECT request_id,request_hash,revision,actor_id,occurred_at,command
    FROM pubquiz.bingo_live_events WHERE run_id=${row.id}::uuid ORDER BY revision`;
  if (rows.length !== row.revision || rows.some((e, i) => e.revision !== i + 1)) fail("INVALID_EVENT_HISTORY");
  const events: LiveEvent[] = rows.map(e => ({ id: e.request_id, at: e.occurred_at.getTime(), actorId: e.actor_id, command: parseLiveCommand(e.command) }));
  const state = replayLive(row.id, row.game_id, frozen(row), row.started_at.getTime(), events, stored);
  if (state.run.status !== row.status || !parseSharedDesign(row.design_snapshot)) fail("INVALID_PERSISTED_RUN");
  return { state, cards: stored, events };
}
export async function startLive(userId: number, input: { gameId: string; roundId: string; requestId: string; expectedSeriesId: number; preparationRevision: number }) {
  assertUuid(input.gameId); assertUuid(input.roundId); assertUuid(input.requestId);
  integer(input.preparationRevision); integer(input.expectedSeriesId);
  const hash = sha256(canonical(input));
  return prisma.$transaction(async tx => {
    const { game, series } = await preparationContext(tx, userId, input.gameId, true);
    if (game.eventreihe_id !== input.expectedSeriesId) fail("SERIES_CHANGED");
    const [old] = await tx.$queryRaw<RunRow[]>`SELECT * FROM pubquiz.bingo_live_runs
      WHERE game_id=${game.id}::uuid AND start_request_id=${input.requestId}::uuid`;
    if (old) { if (old.start_request_hash !== hash) fail("REQUEST_REUSED"); return { runId: old.id }; }
    const [active] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM pubquiz.bingo_live_runs
      WHERE game_id=${game.id}::uuid AND status IN ('RUNNING','PAUSED')`;
    if (active) fail("ACTIVE_RUN_EXISTS");
    const preparation = await tx.bingo_preparations.findUnique({ where: { game_id: game.id } });
    if (preparation?.revision !== input.preparationRevision) fail("PREPARATION_CHANGED");
    const round = await tx.bingo_rounds.findFirst({ where: { id: input.roundId, game_id: game.id }, include: { series: true } });
    if (!round || !round.series.length) fail("NO_ASSIGNED_CARDS");
    const snapshot: FrozenRound = { id: round.id, label: round.label, target: round.planned_draws, issued: round.issued_count, seriesIds: round.series.map(s => s.series_id).sort() };
    const design = (await resolveSharedDesign(tx, game.shared_design_template_id, series)).design;
    const runId = randomUUID(), key = randomUUID(), at = await now(tx);
    initialState(runId, game.id, snapshot, at);
    await tx.$executeRaw`INSERT INTO pubquiz.bingo_live_runs
      (id,game_id,round_id,eventreihe_id,status,started_at,created_by,round_snapshot,design_snapshot,audience_key,start_request_id,start_request_hash)
      VALUES (${runId}::uuid,${game.id}::uuid,${round.id}::uuid,${series.eventreihe_id},'RUNNING',${new Date(at)},${userId},
      ${JSON.stringify(snapshot)}::jsonb,${JSON.stringify(design)}::jsonb,${key}::uuid,${input.requestId}::uuid,${hash})`;
    await tx.$executeRaw`INSERT INTO pubquiz.bingo_live_cards(run_id,card_id)
      SELECT ${runId}::uuid,c.id FROM pubquiz.bingo_cards c JOIN pubquiz.bingo_round_series rs ON rs.series_id=c.series_id
      WHERE rs.round_id=${round.id}::uuid AND rs.game_id=${game.id}::uuid`;
    return { runId };
  }, { timeout: 30000 });
}
export async function commandLive(userId: number, input: { gameId: string; runId: string; requestId: string; revision: number; command: LiveCommand }) {
  assertUuid(input.gameId); assertUuid(input.runId); assertUuid(input.requestId); integer(input.revision);
  const command = parseLiveCommand(input.command), hash = sha256(canonical(input));
  return prisma.$transaction(async tx => {
    const { game } = await preparationContext(tx, userId, input.gameId, true);
    const [row] = await tx.$queryRaw<RunRow[]>`SELECT * FROM pubquiz.bingo_live_runs WHERE id=${input.runId}::uuid AND game_id=${game.id}::uuid FOR UPDATE`;
    if (!row || row.eventreihe_id !== game.eventreihe_id) fail("RUN_NOT_FOUND");
    const [old] = await tx.$queryRaw<EventRow[]>`SELECT request_hash,revision FROM pubquiz.bingo_live_events WHERE run_id=${row.id}::uuid AND request_id=${input.requestId}::uuid`;
    if (old) { if (old.request_hash !== hash) fail("REQUEST_REUSED"); return { revision: old.revision }; }
    if (input.revision !== row.revision) fail("REVISION_CONFLICT");
    const { state, cards, events } = await load(tx, row);
    const at = Math.max(await now(tx), row.started_at.getTime(), events.at(-1)?.at ?? 0);
    const next = applyLiveEvent(state, { id: input.requestId, at, actorId: userId, command }, cards);
    await tx.$executeRaw`INSERT INTO pubquiz.bingo_live_events(run_id,revision,request_id,request_hash,actor_id,occurred_at,command)
      VALUES (${row.id}::uuid,${row.revision + 1},${input.requestId}::uuid,${hash},${userId},${new Date(at)},${JSON.stringify(command)}::jsonb)`;
    await tx.$executeRaw`UPDATE pubquiz.bingo_live_runs SET revision=revision+1,status=${next.run.status} WHERE id=${row.id}::uuid AND revision=${row.revision}`;
    return { revision: row.revision + 1 };
  }, { timeout: 30000 });
}
export async function readLive(userId: number, gameId: string, runId?: string) {
  assertUuid(gameId); if (runId) assertUuid(runId);
  return prisma.$transaction(async tx => {
    const { game, series } = await preparationContext(tx, userId, gameId);
    const runs = await tx.$queryRaw<RunRow[]>`SELECT * FROM pubquiz.bingo_live_runs WHERE game_id=${gameId}::uuid ORDER BY started_at DESC,id DESC`;
    const row = runId ? runs.find(r => r.id === runId) : runs[0];
    if (runId && !row) fail("RUN_NOT_FOUND");
    const data = row ? await load(tx, row) : null;
    const at = Math.max(await now(tx), data?.events.at(-1)?.at ?? row?.started_at.getTime() ?? 0);
    return { gameId, title: game.titel, seriesId: game.eventreihe_id, archived: series.ist_archiviert,
      preparationRevision: (await tx.bingo_preparations.findUnique({ where: { game_id: gameId } }))?.revision ?? 0,
      rounds: await tx.bingo_rounds.findMany({ where: { game_id: gameId }, orderBy: { position: "asc" }, include: { series: { include: { series: { select: { code: true, card_count: true } } } } } }),
      runs: runs.map(r => ({ id: r.id, status: r.status, startedAt: r.started_at.toISOString() })),
      live: row && data ? { ...data, id: row.id, revision: row.revision, round: frozen(row), design: row.design_snapshot, audienceKey: row.audience_key, serverAt: at, elapsedMs: activeElapsedMs(data.state.run, at) } : null };
  }, { isolationLevel: "RepeatableRead" });
}
/** Bearer presentation URL: only confirmed public display data, never cards or moderator notes. */
export async function readAudience(key: string) {
  assertUuid(key);
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const [row] = await tx.$queryRaw<RunRow[]>`SELECT r.* FROM pubquiz.bingo_live_runs r
      JOIN pubquiz.game_drafts g ON g.id=r.game_id AND g.eventreihe_id=r.eventreihe_id AND g.eventart='BINGO'
      JOIN pubquiz.eventreihe_eventarten p ON p.eventreihe_id=g.eventreihe_id AND p.eventart='BINGO' AND p.ist_freigeschaltet
      WHERE r.audience_key=${key}::uuid`;
    if (!row) fail("RUN_NOT_FOUND");
    const { state } = await load(tx, row), round = state.run.rounds[0];
    return { id: row.id, revision: row.revision, status: state.run.status, label: frozen(row).label,
      target: round.plannedDraws, draws: round.draws, design: row.design_snapshot,
      claims: round.claims.map(c => ({ id: c.id, stage: c.stage, action: c.decisions.at(-1)?.action ?? null, needsReview: c.needsReview })) };
  }, { isolationLevel: "RepeatableRead" });
}
export type ModerationView = Awaited<ReturnType<typeof readLive>>;
export type AudienceView = Awaited<ReturnType<typeof readAudience>>;
