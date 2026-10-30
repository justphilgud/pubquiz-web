import { type BingoCard, type Stage } from "../core/cards";
import { addRound, closeRound, endRun, openRound, pauseRun, resumeRun, type BingoRun } from "../core/run";
import { correctDraw, decideClaim, recordClaim } from "../core/round";
import { applyLiveEvent, assertUuid, initialState, parseLiveCommand, type Call, type FrozenRound, type LiveCommand, type LiveEvent } from "./live";

/** V2 is opt-in. AP3 replay and its one-round histories are deliberately unchanged. */
export type EventCall = Call & { roundId: string; recordedAt: number };
export type EventRunState = { version: 2; run: BingoRun; calls: readonly EventCall[]; frozen: readonly FrozenRound[] };
export type EventCommand = Exclude<LiveCommand, { kind: "call" } | { kind: "correct" }> |
  { kind: "call"; stage: Stage; context: string } |
  { kind: "correct"; drawId: string; number: number; reason: string } |
  { kind: "closeRound" } | { kind: "startRound"; roundId: string };
export type EventRunEvent = Omit<LiveEvent, "command"> & { command: EventCommand; frozen?: FrozenRound };
export function parseEventCommand(value: unknown): EventCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("INVALID_COMMAND");
  const r = value as Record<string, unknown>;
  if (r.kind === "closeRound") { if (Object.keys(r).join() !== "kind") throw Error("INVALID_COMMAND"); return {kind:"closeRound"}; }
  if (r.kind === "startRound") { assertUuid(r.roundId); if(Object.keys(r).sort().join()!=="kind,roundId")throw Error("INVALID_COMMAND");return {kind:"startRound",roundId:r.roundId}; }
  if (r.kind === "call") {
    if (Object.keys(r).sort().join() !== "context,kind,stage" || typeof r.context !== "string" || !/^[a-f0-9]{64}$/.test(r.context)) throw Error("INVALID_CALL_CONTEXT");
    parseLiveCommand({kind:"call",stage:r.stage}); return r as EventCommand;
  }
  if (r.kind === "correct") {
    assertUuid(r.drawId); if(Object.keys(r).sort().join()!=="drawId,kind,number,reason")throw Error("INVALID_COMMAND");
    parseLiveCommand({kind:"correct",number:r.number,reason:r.reason}); return r as EventCommand;
  }
  return parseLiveCommand(value) as EventCommand;
}
export function initialEventRun(runId: string, gameId: string, round: FrozenRound, at: number): EventRunState {
  return {version:2,...initialState(runId,gameId,round,at),calls:[],frozen:[round]};
}
export function currentEventRound(state: EventRunState) { return state.run.rounds.find(r=>r.status==="OPEN") ?? state.run.rounds.at(-1)!; }
export function blockingCalls(state: EventRunState): boolean {
  const round=currentEventRound(state);
  return state.calls.filter(c=>c.roundId===round.id).some(call=>{
    const claim=round.claims.find(c=>c.id===call.id);
    return !claim || !claim.decisions.length || claim.needsReview;
  });
}
/** Pure context, subsequently hashed by the service. Calls/identifications/decisions do not move a draw boundary. */
export function callContextData(state: EventRunState) {
  const r=currentEventRound(state);
  return {runId:state.run.id,status:state.run.status,roundId:r.id,roundStatus:r.status,target:r.plannedDraws,draws:r.draws,corrections:r.corrections};
}
export function applyEventRunEvent(state: EventRunState, event: EventRunEvent, cards: readonly BingoCard[]): EventRunState {
  const c=parseEventCommand(event.command),run=state.run,round=currentEventRound(state);
  assertUuid(event.id);
  if (!Number.isSafeInteger(event.at)||event.at<run.lastTransitionAt||!Number.isSafeInteger(event.actorId)||event.actorId<1)throw Error("INVALID_EVENT");
  if(run.status==="ENDED")throw Error("RUN_ENDED");
  const replace=(next:typeof round):EventRunState=>({...state,run:{...run,rounds:run.rounds.map(r=>r.id===round.id?next:r)}});
  if(c.kind==="startRound") {
    if(run.rounds.some(r=>r.status==="OPEN")||run.status!=="PAUSED")throw Error("ROUND_STILL_OPEN");
    const frozen=event.frozen;
    if(!frozen||frozen.id!==c.roundId||run.rounds.some(r=>r.id===c.roundId))throw Error("INVALID_NEXT_ROUND");
    const next=openRound(addRound(resumeRun(run,event.at),frozen.id,frozen.target),frozen.id);
    return {...state,run:next,frozen:[...state.frozen,frozen]};
  }
  if(c.kind==="end") {
    if(blockingCalls(state))throw Error("OPEN_CLAIMS");
    return {...state,run:endRun(run,event.at)};
  }
  if(round.status!=="OPEN")throw Error("ROUND_NOT_OPEN");
  if(c.kind==="closeRound") {
    if(blockingCalls(state))throw Error("OPEN_CLAIMS");
    const closed=closeRound(run,round.id);
    return {...state,run:closed.status==="RUNNING"?pauseRun(closed,event.at):closed};
  }
  if(c.kind==="resume" && !run.rounds.some(r=>r.status==="OPEN"))throw Error("ROUND_NOT_OPEN");
  if(c.kind==="draw"&&blockingCalls(state))throw Error("OPEN_CLAIMS");
  if(c.kind==="call") {
    if(run.status!=="RUNNING")throw Error("RUN_NOT_RUNNING");
    if(state.calls.some(call=>call.id===event.id))throw Error("DUPLICATE_CLAIM_ID");
    return {...state,calls:[...state.calls,{id:event.id,roundId:round.id,recordedAt:event.at,stage:c.stage,throughPosition:round.draws.length,draws:round.draws,cardId:null}]};
  }
  if(c.kind==="identify") {
    const call=state.calls.find(call=>call.id===c.callId&&call.roundId===round.id),card=cards.find(card=>card.id===c.cardId);
    if(!call||call.cardId||!card)throw Error("CARD_OR_CALL_NOT_FOUND");
    const original=recordClaim({...round,draws:call.draws},call.id,card,call.stage).claims.at(-1)!;
    return {...replace({...round,claims:[...round.claims,original]}),calls:state.calls.map(item=>item.id===call.id?{...item,cardId:card.id}:item)};
  }
  if(c.kind==="decide") {
    const claim=round.claims.find(claim=>claim.id===c.callId),card=cards.find(card=>card.id===claim?.cardId);
    if(!card)throw Error("CARD_OR_CALL_NOT_FOUND");
    return replace(decideClaim(round,c.callId,card,{id:event.id,action:c.action,reason:c.reason}));
  }
  if(c.kind==="correct") {
    if(run.status!=="RUNNING"&&run.status!=="PAUSED")throw Error("RUN_NOT_ACTIVE");
    return replace(correctDraw(round,c.drawId,c.number,{id:event.id,reason:c.reason},cards).round);
  }
  // Existing AP3 adapter is reused only for single-current-round arithmetic/clock commands.
  const partial=applyLiveEvent({run:{...run,rounds:[round]},calls:[]},{...event,command:c},cards);
  return {...state,run:{...partial.run,rounds:run.rounds.map(r=>r.id===round.id?partial.run.rounds[0]:r)}};
}
