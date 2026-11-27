import {registerTickets,type RaffleTicket} from "./raffle";
import type { CardCheck } from './cardChecks';
import { evaluateCard, requireNumber, type BingoCard, type Stage } from "../core/cards";
import { addRound, closeRound, endRun, openRound, pauseRun, resumeRun, type BingoRun } from "../core/run";
import { correctDraw, decideClaim, recordClaim, evaluateClaim, isConfirmed } from "../core/round";
import { applyLiveEvent, assertUuid, initialState, parseLiveCommand, type Call, type FrozenRound, type LiveCommand, type LiveEvent } from "./live";

/** V2 is opt-in. AP3 replay and its one-round histories are deliberately unchanged. */
export type EventCall = Call & { roundId: string; recordedAt: number };
export type BingoPlayback = {id:string;drawId:string;action:'PLAY'|'PAUSE'|'REPLAY';at:number;sequence:number;restartId:string|null;position:number};
export type EventRunState = { tickets?:readonly RaffleTicket[]; checks?: readonly CardCheck[]; playback?:BingoPlayback; revealed?:readonly string[]; version: 2; contextRevision:number; run: BingoRun; calls: readonly EventCall[]; frozen: readonly FrozenRound[] };
export type EventCommand = Exclude<LiveCommand, { kind: "call" } | { kind: "correct" }> |
  { kind: "call"; stage: Stage; context: string } | {kind:"check";cardId:string;context:string} | {kind:"decideCheck";checkId:string;action:"CONFIRM"|"REJECT"|"REVOKE";reason:string} | {kind:"reveal";drawId:string} |
  {kind:'playback';drawId:string;action:'PLAY'|'PAUSE'|'REPLAY'} |
  { kind: "correct"; drawId: string; number: number; reason: string } |
  { kind: "closeRound" } | { kind: "startRound"; roundId: string; preparationRevision:number } | {kind:"appendRound";label:string;target:number;preparationRevision:number};
export type EventRunEvent = Omit<LiveEvent, "command"> & { command: EventCommand; frozen?: FrozenRound };
export function parseEventCommand(value: unknown): EventCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("INVALID_COMMAND");
  const r = value as Record<string, unknown>;
  if(r.kind==='decideCheck'){assertUuid(r.checkId);if(Object.keys(r).sort().join()!=='action,checkId,kind,reason')throw Error('INVALID_COMMAND');parseLiveCommand({kind:'decide',callId:r.checkId,action:r.action,reason:r.reason});return r as EventCommand;}
  if(r.kind==='check') {assertUuid(r.cardId);if(Object.keys(r).sort().join()!=='cardId,context,kind'||typeof r.context!=='string'||! /^[a-f0-9]{64}$/.test(r.context))throw Error('INVALID_CALL_CONTEXT');return r as EventCommand;}
  if(r.kind==='playback'){assertUuid(r.drawId);if(Object.keys(r).sort().join()!=='action,drawId,kind'||!['PLAY','PAUSE','REPLAY'].includes(String(r.action)))throw Error('INVALID_COMMAND');return r as EventCommand;}
  if(r.kind==='reveal'){assertUuid(r.drawId);if(Object.keys(r).sort().join()!=='drawId,kind')throw Error('INVALID_COMMAND');return r as EventCommand;}
  if (r.kind === "closeRound") { if (Object.keys(r).join() !== "kind") throw Error("INVALID_COMMAND"); return {kind:"closeRound"}; }
  if(r.kind==="appendRound") {if(Object.keys(r).sort().join()!=="kind,label,preparationRevision,target"||typeof r.label!=="string"||!r.label.trim()||r.label.length>80||!Number.isSafeInteger(r.preparationRevision)||Number(r.preparationRevision)<0||!Number.isInteger(r.target)||Number(r.target)<1||Number(r.target)>75)throw Error("INVALID_COMMAND");return r as EventCommand;}
  if (r.kind === "startRound") { assertUuid(r.roundId); if(Object.keys(r).sort().join()!=="kind,preparationRevision,roundId"||!Number.isSafeInteger(r.preparationRevision)||Number(r.preparationRevision)<0)throw Error("INVALID_COMMAND");return {kind:"startRound",roundId:r.roundId,preparationRevision:Number(r.preparationRevision)}; }
  if (r.kind === "call") {
    if (Object.keys(r).sort().join() !== "context,kind,stage" || typeof r.context !== "string" || !/^[a-f0-9]{64}$/.test(r.context)) throw Error("INVALID_CALL_CONTEXT");
    parseLiveCommand({kind:"call",stage:r.stage}); return r as EventCommand;
  }
  if (r.kind === "correct") {
    assertUuid(r.drawId); if(Object.keys(r).sort().join()!=="drawId,kind,number,reason")throw Error("INVALID_COMMAND");
    if(r.reason==='') requireNumber(r.number as number);
    else parseLiveCommand({kind:"correct",number:r.number,reason:r.reason});
    return r as EventCommand;
  }
  return parseLiveCommand(value) as EventCommand;
}
export function initialEventRun(runId: string, gameId: string, round: FrozenRound, at: number): EventRunState {
  return {version:2,contextRevision:0,...initialState(runId,gameId,round,at),calls:[],frozen:[round]};
}
export function currentEventRound(state: EventRunState) { return state.run.rounds.find(r=>r.status==="OPEN") ?? state.run.rounds.at(-1)!; }
export function blockingCalls(state: EventRunState): boolean {
  const round=currentEventRound(state);
  return state.calls.filter(c=>c.roundId===round.id&&state.checks?.some(check=>check.id===c.id)).some(call=>{
    const claim=round.claims.find(c=>c.id===call.id);
    return !claim || !claim.decisions.length || claim.needsReview;
  });
}
/** Applied only to new writes, never to journal parsing/replay or old retries. */
export function assertCurrentEventCommand(command: EventCommand): void {
  if (['call','identify','decide'].includes(command.kind)) throw Error('LEGACY_CALL_READ_ONLY');
}
/** Pure context, subsequently hashed by the service. Calls/identifications/decisions do not move a draw boundary. */
export function callContextData(state: EventRunState) {
  const r=currentEventRound(state);
  return {contextRevision:state.contextRevision,runId:state.run.id,status:state.run.status,roundId:r.id,roundStatus:r.status,target:r.plannedDraws,draws:r.draws,corrections:r.corrections};
}
function applyEventRunEventInner(state: EventRunState, event: EventRunEvent, cards: readonly BingoCard[]): EventRunState {
  const c=parseEventCommand(event.command),run=state.run,round=currentEventRound(state);
  assertUuid(event.id);
  if (!Number.isSafeInteger(event.at)||event.at<run.lastTransitionAt||!Number.isSafeInteger(event.actorId)||event.actorId<1)throw Error("INVALID_EVENT");
  if(run.status==="ENDED")throw Error("RUN_ENDED");
  const replace=(next:typeof round):EventRunState=>({...state,run:{...run,rounds:run.rounds.map(r=>r.id===round.id?next:r)}});
  if(c.kind==="appendRound")return state;
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
  if(c.kind==='reveal'){const frozen=state.frozen.find(f=>f.id===round.id);if(!round.draws.some(d=>d.id===c.drawId)||!frozen?.terms&&!frozen?.matching)throw Error('DRAW_NOT_FOUND');if(state.revealed?.includes(c.drawId))throw Error('ALREADY_REVEALED');return {...state,revealed:[...(state.revealed??[]),c.drawId]};}
  if(c.kind==='playback'){if(!state.frozen.find(f=>f.id===round.id)?.matching||round.draws.at(-1)?.id!==c.drawId)throw Error('MEDIA_CONTEXT_CHANGED');if(c.action!=='PAUSE'&&run.status!=='RUNNING')throw Error('RUN_NOT_RUNNING');const prior=state.playback,position=c.action==='REPLAY'?0:prior?prior.position+(prior.action==='PAUSE'?0:Math.max(0,event.at-prior.at)/1000):0;return {...state,playback:{id:event.id,drawId:c.drawId,action:c.action,at:event.at,sequence:(prior?.sequence??0)+1,restartId:c.action==='REPLAY'?event.id:prior?.restartId??null,position}};}
  if(c.kind==="resume" && !run.rounds.some(r=>r.status==="OPEN"))throw Error("ROUND_NOT_OPEN");

  if(c.kind==='decideCheck') {
    const check=state.checks?.find(check=>check.id===c.checkId&&check.roundId===round.id),card=cards.find(card=>card.id===check?.cardId);
    if(!check||!card)throw Error('CARD_OR_CALL_NOT_FOUND');
    const evaluation=evaluateCard(card.cells,round.draws.slice(0,check.throughPosition).map(d=>d.number));
    const stage=evaluation.stages.at(-1)??'BINGO';
    const directIds=new Set(state.checks?.map(item=>item.id));
    const directRound={...round,claims:round.claims.filter(claim=>directIds.has(claim.id))};
    const existing=directRound.claims.find(claim=>claim.id===check.id);
    const withClaim=existing?directRound:recordClaim({...directRound,draws:check.draws},check.id,card,stage);
    const next=decideClaim({...withClaim,draws:round.draws},check.id,card,{id:event.id,action:c.action,reason:c.reason});
    const merged={...next,claims:[...round.claims.map(claim=>next.claims.find(item=>item.id===claim.id)??claim),...next.claims.filter(claim=>!round.claims.some(item=>item.id===claim.id))]};
    return {...replace(merged),calls:state.calls.some(call=>call.id===check.id)?state.calls:[...state.calls,{id:check.id,roundId:round.id,recordedAt:check.at,stage,throughPosition:check.throughPosition,draws:check.draws,cardId:card.id}]};
  }
  if(c.kind==='check') {
    if(run.status!=='RUNNING'&&run.status!=='PAUSED')throw Error('RUN_NOT_RUNNING');
    const card=cards.find(card=>card.id===c.cardId);
    if(!card)throw Error('CARD_OR_CALL_NOT_FOUND');
    return {...state,checks:[...(state.checks??[]),{id:event.id,roundId:round.id,cardId:card.id,at:event.at,throughPosition:round.draws.length,draws:round.draws,original:evaluateCard(card.cells,round.draws.map(d=>d.number))}]};
  }
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
    const corrected=correctDraw(round,c.drawId,c.number,{id:event.id,reason:c.reason},cards,{allowEmptyReason:true}).round;
    const claims=corrected.claims.map(claim=>{
      const card=cards.find(card=>card.id===claim.cardId);
      const lost=card&&isConfirmed(claim)&&(state.tickets??[]).some(ticket=>ticket.roundId===round.id&&ticket.claimIds.includes(claim.id)&&!evaluateClaim(corrected,claim,card).lines.includes(ticket.line));
      return lost?{...claim,needsReview:true}:claim;
    });
    return {...replace({...corrected,claims}),...(state.revealed?{revealed:state.revealed.filter(id=>id!==c.drawId)}:{})};
  }
  // Existing AP3 adapter is reused only for single-current-round arithmetic/clock commands.
  const partial=applyLiveEvent({run:{...run,rounds:[round]},calls:[]},{...event,command:c},cards);
  return {...state,run:{...partial.run,rounds:run.rounds.map(r=>r.id===round.id?partial.run.rounds[0]:r)}};
}

export function applyEventRunEvent(state:EventRunState,event:EventRunEvent,cards:readonly BingoCard[]):EventRunState {
 const next=applyEventRunEventInner(state,event,cards);
 let tickets=next.tickets;
 if((event.command.kind==="decideCheck"||event.command.kind==="decide")&&event.command.action==="CONFIRM"){const id=event.command.kind==="decideCheck"?event.command.checkId:event.command.callId;const round=currentEventRound(next),claim=round.claims.find(c=>c.id===id),card=cards.find(c=>c.id===claim?.cardId);if(card)tickets=registerTickets(tickets??[],round,id,card);}
 const clear=['draw','closeRound','startRound','end'].includes(event.command.kind)||event.command.kind==='correct'&&currentEventRound(state).draws.at(-1)?.id===event.command.drawId;
 const paused=event.command.kind==='pause'&&state.playback?{playback:{...state.playback,id:event.id,action:'PAUSE' as const,at:event.at,sequence:state.playback.sequence+1,position:state.playback.position+(state.playback.action==='PAUSE'?0:Math.max(0,event.at-state.playback.at)/1000)}}:{};
 return {...next,...(tickets?{tickets}:{}),...(clear?{playback:undefined}:paused),contextRevision:["call","check","decideCheck","identify","decide","reveal","playback"].includes(event.command.kind)?state.contextRevision:state.contextRevision+1};
}
