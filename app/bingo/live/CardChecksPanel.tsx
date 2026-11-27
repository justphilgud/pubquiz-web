'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { resolveCardCode } from './actions';
import { checkEvaluation, checkResult, groupChecks, type CardCheck } from './cardChecks';
import type { StoredCard } from '../preparation/policy';
import type { EventCommand } from './eventRun';
import type { Claim } from '../core/round';
import type { Draw } from '../core/round';
import styles from './EventModerationPanel.module.css';

export default function CardChecksPanel({gameId,runId,checks,cards,draws,claims,tickets,disabled,onCheck,onDecision}:{gameId:string;runId:string;checks:readonly CardCheck[];cards:readonly StoredCard[];draws:readonly Draw[];claims:readonly Claim[];tickets?:readonly {number:number;cardId:string;valid:boolean}[];onDecision:(command:Extract<EventCommand,{kind:"decideCheck"}>)=>void;disabled:boolean;onCheck:(cardId:string)=>Promise<boolean|undefined>}) {
  const [code,setCode]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(false),[selected,setSelected]=useState<string|null>(null);
  const [decisionId,setDecisionId]=useState('');
  const input=useRef<HTMLInputElement>(null),inflight=useRef(false),focusNext=useRef(false);
  useEffect(()=>{if(focusNext.current&&!pending&&!disabled){input.current?.focus();focusNext.current=false;}},[pending,disabled]);
  const groups=groupChecks(checks);
  return <section id="card-checks" className={styles.panel} aria-label="Automatische Kartenprüfung"><h2>Karte prüfen</h2>
    <form className={styles.checkForm} onSubmit={async e=>{e.preventDefault();if(inflight.current||disabled)return;inflight.current=true;setPending(true);setMessage('');try{const result=await resolveCardCode(gameId,code);if(!result.success){setMessage(result.message);return;}if(await onCheck(result.cardId)){setCode('');focusNext.current=true;}}catch{setMessage('Prüfung fehlgeschlagen. Eingabe bleibt erhalten.');}finally{inflight.current=false;setPending(false);}}}>
      <label><span className={styles.visuallyHidden}>Kartenkennung</span><input ref={input} placeholder="Karte prüfen" required maxLength={64} value={code} onChange={e=>setCode(e.target.value)} disabled={pending||disabled} autoComplete="off"/></label><button className={styles.call} disabled={pending||disabled||!code.trim()}>{pending?'Wird geprüft …':'Check'}</button>
    </form>{message&&<p role="alert">{message}</p>}
    <p className={styles.hint}>Prüfung ermittelt Linien, bestätigt keinen Gewinn. Erneute Prüfung ergänzt die Historie derselben Karte.</p>
    <p className={styles.legend}><span data-result="0">✕ Kein Bingo</span><span data-result="1">✓ Bingo</span><span data-result="2">✓✓ Doppel</span><span data-result="3">★ Triple</span></p>
    <div className={styles.checkScroll} tabIndex={0} aria-label="Gespeicherte Kartenprüfungen"><ol className={styles.checkGrid}>{groups.map(history=>{
      const check=history.at(-1)!,card=cards.find(c=>c.id===check.cardId);if(!card)return null;
      const result=checkResult(checkEvaluation(check,card,draws)),claim=claims.find(c=>c.id===check.id)??[...claims].reverse().find(c=>c.cardId===check.cardId&&c.decisions.at(-1)?.action==='CONFIRM'),decision=claim?.decisions.at(-1);
      const status=claim?.needsReview?'Nachprüfung':decision?{CONFIRM:'Bestätigt',REJECT:'Abgelehnt',REVOKE:'Widerrufen'}[decision.action]:'Offen';
      return <li key={check.cardId} data-result={result.level}><div className={styles.checkHeading}><strong>{card.shortCode??card.code}</strong><button aria-label={`${card.shortCode??card.code}: Prüfungen und Entscheidung`} onClick={()=>{setSelected(check.cardId);setDecisionId(claim?.needsReview?claim.id:check.id);}}>⋯</button></div><Link href={`/bingo/${gameId}/pruefungen/${check.id}?run=${runId}`} target="_blank" rel="noopener"><span>{result.label}</span><small>{result.lines} Linien · Ziehung {check.throughPosition}</small></Link><small>{status}{tickets?.some(t=>t.cardId===card.id&&t.valid)?` · Lose ${tickets.filter(t=>t.cardId===card.id&&t.valid).map(t=>t.number).join(', ')}`:null}{history.length>1?` · ${history.length} Prüfungen`:''}</small></li>;
    })}</ol></div>
    {selected&&(()=>{
      const history=groups.find(g=>g[0].cardId===selected);if(!history)return null;
      const check=history.find(c=>c.id===decisionId)??history.at(-1)!,card=cards.find(c=>c.id===check.cardId);if(!card)return null;
      const result=checkResult(checkEvaluation(check,card,draws));
      const changed=check.original.lines.join()!==checkEvaluation(check,card,draws).lines.join();
      return <section className={styles.claim} aria-label="Ausgewählte Kartenprüfung"><h3>{card.shortCode??card.code} · {result.label}</h3><button onClick={()=>setSelected(null)}>Details schließen</button>{changed&&<p>Nach Korrektur geändert. Ursprüngliche Nachweise bleiben erhalten.</p>}
        <label>Prüfung für Entscheidung<select value={check.id} onChange={e=>setDecisionId(e.target.value)}>{history.map(c=><option key={c.id} value={c.id}>Ziehung {c.throughPosition} · {new Date(c.at).toLocaleTimeString('de-DE')} · {claims.find(claim=>claim.id===c.id)?.decisions.at(-1)?.action??'Noch keine Entscheidung'}</option>)}</select></label>
        <h3>Prüfhistorie</h3>{history.map(c=><p key={c.id}><Link target="_blank" rel="noopener" href={`/bingo/${gameId}/pruefungen/${c.id}?run=${runId}`}>{new Date(c.at).toLocaleString('de-DE')} · Ziehung {c.throughPosition} · {checkResult(c.original).label}</Link></p>)}
        {!disabled&&<form onSubmit={e=>{e.preventDefault();const values=new FormData(e.currentTarget),action=String(values.get('action')) as 'CONFIRM'|'REJECT'|'REVOKE';onDecision({kind:'decideCheck',checkId:check.id,action,reason:String(values.get('reason'))});}}><label>Begründung<input name="reason" required maxLength={1000}/></label><label>Aktion<select name="action" defaultValue={result.level?'CONFIRM':'REJECT'}><option value="CONFIRM" disabled={result.level===0}>Gewinn bestätigen</option><option value="REJECT">Prüfung ablehnen</option><option value="REVOKE">Bestätigung widerrufen</option></select></label><button>Entscheidung prüfen</button></form>}
      </section>;
    })()}
  </section>;
}
