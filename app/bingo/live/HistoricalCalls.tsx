'use client';
import {useState} from 'react';
import type {EventCommand,EventRunState} from './eventRun';
import type {BingoRound} from '../core/round';
import type {StoredCard} from '../preparation/policy';
/** Compatibility only: saved automatic checks use CardChecksPanel exclusively. */
export default function HistoricalCalls({state,round,cards,disabled,onCommand}:{state:EventRunState;round:BingoRound;cards:readonly StoredCard[];disabled:boolean;onCommand:(command:EventCommand)=>void}){
 const [drafts,setDrafts]=useState<Record<string,{code:string;reason:string}>>({});
 const calls=state.calls.filter(c=>c.roundId===round.id&&!state.checks?.some(check=>check.id===c.id));
 if(!calls.length)return null;
 return <details><summary>Frühere Rufe klären ({calls.length})</summary>{calls.map(call=>{
  const claim=round.claims.find(c=>c.id===call.id),draft=drafts[call.id]??{code:'',reason:''},card=cards.find(c=>c.id===call.cardId);
  const update=(patch:Partial<typeof draft>)=>setDrafts(old=>({...old,[call.id]:{...draft,...patch}}));
  return <section key={call.id} id={`call-${call.id}`}><h3>{call.stage} · Ziehung {call.throughPosition} · {card?.shortCode??'Karte zuordnen'}</h3><p>{claim?.needsReview?'Nachprüfung erforderlich':claim?.decisions.at(-1)?.action??'Offen'}</p>{!card?<form onSubmit={e=>{e.preventDefault();const found=cards.find(c=>[c.id,c.code,c.shortCode??''].some(code=>code.toUpperCase()===draft.code.trim().toUpperCase()));if(found)onCommand({kind:'identify',callId:call.id,cardId:found.id});}}><label>Kartenkennung<input required value={draft.code} onChange={e=>update({code:e.target.value})}/></label><button disabled={disabled||!cards.some(c=>[c.id,c.code,c.shortCode??''].some(code=>code.toUpperCase()===draft.code.trim().toUpperCase()))}>Zuordnen</button></form>:<><label>Begründung<input value={draft.reason} maxLength={1000} required onChange={e=>update({reason:e.target.value})}/></label>{(['CONFIRM','REJECT','REVOKE'] as const).map(action=><button key={action} disabled={disabled||!draft.reason.trim()} onClick={()=>onCommand({kind:'decide',callId:call.id,action,reason:draft.reason})}>{{CONFIRM:'Bestätigen',REJECT:'Ablehnen',REVOKE:'Widerrufen'}[action]}</button>)}</>}</section>;
 })}</details>;
}
