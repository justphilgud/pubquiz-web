import { type BingoCard, type Stage, validateCard } from "../core/cards";
import { addRound, createRun, drawNumber, endRun, pauseRun, resumeRun, startRun, type BingoRun } from "../core/run";
import { correctDraw, decideClaim, recordClaim, setTarget, type Draw } from "../core/round";

export type LiveCommand =
  | { kind: "draw"; number: number }
  | { kind: "pause" | "resume" | "end" }
  | { kind: "target"; number: number }
  | { kind: "call"; stage: Stage }
  | { kind: "identify"; callId: string; cardId: string }
  | { kind: "decide"; callId: string; action: "CONFIRM" | "REJECT" | "REVOKE"; reason: string }
  | { kind: "correct"; number: number; reason: string };
export type LiveEvent = { id: string; at: number; actorId: number; command: LiveCommand };
export type Call = { id: string; stage: Stage; throughPosition: number; cardId: string | null; draws: readonly Draw[] };
export type LiveState = { run: BingoRun; calls: readonly Call[] };
export type FrozenRound = { id: string; label: string; target: number; issued: number | null; seriesIds: string[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(value: unknown): asserts value is string {
  if (typeof value !== "string" || !uuid.test(value)) throw Error("INVALID_ID");
}
function text(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 1000) throw Error("REASON_REQUIRED");
}
export function parseLiveCommand(value: unknown): LiveCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("INVALID_COMMAND");
  const r = value as Record<string, unknown>;
  let keys: string[];
  switch (r.kind) {
    case "draw": case "target": case "correct":
      if (typeof r.number !== "number" || !Number.isInteger(r.number) || r.number < 1 || r.number > 75) throw Error("INVALID_NUMBER");
      if (r.kind === "correct") text(r.reason);
      keys = r.kind === "correct" ? ["kind", "number", "reason"] : ["kind", "number"]; break;
    case "pause": case "resume": case "end": keys = ["kind"]; break;
    case "call":
      if (!["BINGO", "DOUBLE", "TRIPLE"].includes(String(r.stage))) throw Error("INVALID_STAGE");
      keys = ["kind", "stage"]; break;
    case "identify": assertUuid(r.callId); assertUuid(r.cardId); keys = ["kind", "callId", "cardId"]; break;
    case "decide":
      assertUuid(r.callId); text(r.reason);
      if (!["CONFIRM", "REJECT", "REVOKE"].includes(String(r.action))) throw Error("INVALID_DECISION");
      keys = ["kind", "callId", "action", "reason"]; break;
    default: throw Error("INVALID_COMMAND");
  }
  if (Object.keys(r).sort().join() !== keys.sort().join()) throw Error("INVALID_COMMAND");
  return r as LiveCommand;
}
export function initialState(runId: string, gameId: string, round: FrozenRound, at: number): LiveState {
  assertUuid(runId); assertUuid(gameId); assertUuid(round.id);
  return { run: startRun(addRound(createRun(runId, gameId, at), round.id, round.target), round.id, at, []), calls: [] };
}
/** Replayed server events validate persisted aggregates rather than trusting state JSON. */
export function applyLiveEvent(state: LiveState, event: LiveEvent, cards: readonly BingoCard[]): LiveState {
  assertUuid(event.id);
  if (!Number.isSafeInteger(event.at) || event.at < state.run.lastTransitionAt ||
      !Number.isSafeInteger(event.actorId) || event.actorId < 1) throw Error("INVALID_EVENT");
  const c = parseLiveCommand(event.command), run = state.run;
  if (run.status === "ENDED") throw Error("RUN_ENDED");
  const round = run.rounds[0];
  if (!round || round.status !== "OPEN") throw Error("ROUND_NOT_OPEN");
  const replace = (next: typeof round): LiveState => ({ ...state, run: { ...run, rounds: [next] } });
  switch (c.kind) {
    case "pause": return { ...state, run: pauseRun(run, event.at) };
    case "resume": return { ...state, run: resumeRun(run, event.at) };
    case "end": return { ...state, run: endRun(run, event.at) };
    case "draw": return { ...state, run: drawNumber(run, round.id, event.id, c.number) };
    case "target": return replace(setTarget(round, c.number));
    case "call":
      if (run.status !== "RUNNING") throw Error("RUN_NOT_RUNNING");
      if (state.calls.some(call => call.id === event.id)) throw Error("DUPLICATE_CLAIM_ID");
      return { ...state, calls: [...state.calls, { id: event.id, stage: c.stage, throughPosition: round.draws.length, cardId: null, draws: round.draws }] };
    case "identify": {
      const call = state.calls.find(call => call.id === c.callId);
      const card = cards.find(card => card.id === c.cardId);
      if (!call || call.cardId || !card) throw Error("CARD_OR_CALL_NOT_FOUND");
      validateCard(card.cells);
      // Capture is committed before search. Later draws cannot heal the original call.
      const atCall = { ...round, draws: call.draws };
      const claim = recordClaim(atCall, call.id, card, call.stage).claims.at(-1)!;
      return { run: { ...run, rounds: [{ ...round, claims: [...round.claims, claim] }] },
        calls: state.calls.map(item => item.id === call.id ? { ...item, cardId: card.id } : item) };
    }
    case "decide": {
      const claim = round.claims.find(claim => claim.id === c.callId);
      const card = cards.find(card => card.id === claim?.cardId);
      if (!card) throw Error("CARD_OR_CALL_NOT_FOUND");
      return replace(decideClaim(round, c.callId, card, { id: event.id, action: c.action, reason: c.reason }));
    }
    case "correct":
      if (run.status !== "RUNNING" && run.status !== "PAUSED") throw Error("RUN_NOT_ACTIVE");
      if (!round.draws.length) throw Error("DRAW_NOT_FOUND");
      return replace(correctDraw(round, round.draws.at(-1)!.id, c.number, { id: event.id, reason: c.reason }, cards).round);
  }
}
export function replayLive(runId: string, gameId: string, round: FrozenRound, startedAt: number, events: readonly LiveEvent[], cards: readonly BingoCard[]): LiveState {
  let state = initialState(runId, gameId, round, startedAt), previousAt = startedAt;
  const ids = new Set<string>();
  for (const event of events) {
    if (ids.has(event.id) || event.at < previousAt) throw Error("INVALID_EVENT_HISTORY");
    ids.add(event.id); previousAt = event.at;
    state = applyLiveEvent(state, event, cards);
  }
  return state;
}
