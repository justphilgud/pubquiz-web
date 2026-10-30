"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState,type CSSProperties} from "react";
import {useRouter} from "next/navigation";
import {Modal} from "@/components/ui";
import {PHIL_GUD} from "@/app/branding/philGud";
import {useContentNavigationGuard} from "@/app/components/content/useContentNavigationGuard";
import {RoundEditor} from "../preparation/PreparationPanel";
import {evaluateClaim} from "../core/round";
import {currentEventRound,type EventCommand} from "./eventRun";
import type {EventModerationView} from "./eventRepository.server";
import {saveEventRun} from "./actions";
import {fetchLiveView} from "./useLivePolling";
import styles from "./EventModerationPanel.module.css";
type Input=Parameters<typeof saveEventRun>[0];
const stages=[['BINGO','Bingo'],['DOUBLE','Doppel-Bingo'],['TRIPLE','Triple-Bingo']] as const;
export default function EventModerationPanel({initial}:{initial:EventModerationView}){
 const router=useRouter(),[data,setData]=useState(initial),current=useRef(initial);
 const [connected,setConnected]=useState(true),[message,setMessage]=useState(''),[number,setNumber]=useState('');
 const [drafts,setDrafts]=useState<Record<string,{card:string;reason:string}>>({});
 const [selectedDraw,setSelectedDraw]=useState(''),[replacement,setReplacement]=useState(''),[correctionReason,setCorrectionReason]=useState('');
 const [target,setTarget]=useState(''),[extraLabel,setExtraLabel]=useState('Zusatzrunde'),[extraOpen,setExtraOpen]=useState(false);
 const [busy,setBusy]=useState<Set<string>>(new Set()),inflight=useRef(new Set<string>()),[retries,setRetries]=useState<Input[]>([]);
 const [confirmation,setConfirmation]=useState<{title:string;input:Input}|null>(null);
 const [prepDirty,setPrepDirty]=useState<Set<string>>(new Set()),[prepBusy,setPrepBusy]=useState<Set<string>>(new Set());
 const trackDirty=useCallback((id:string,value:boolean)=>setPrepDirty(s=>{const n=new Set(s);if(value)n.add(id);else n.delete(id);return n;}),[]);
 const trackBusy=useCallback((id:string,value:boolean)=>setPrepBusy(s=>{const n=new Set(s);if(value)n.add(id);else n.delete(id);return n;}),[]);
 useContentNavigationGuard(Boolean(number||replacement||correctionReason||target||Object.values(drafts).some(d=>d.card||d.reason)||prepDirty.size));
 const runId=initial.live?.id;
 const accept=useCallback((next:EventModerationView)=>{
  const old=current.current.live,fresh=next.live;
  if(old&&(!fresh||fresh.id!==old.id||fresh.revision<old.revision))return;
  current.current=next;setData(next);setConnected(true);
 },[]);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const next=await fetchLiveView<EventModerationView>(`/api/bingo/live/${initial.gameId}${runId?`?run=${runId}`:initial.prepareNew?'?new=1':''}`,signal);
  if(next.protocol!==2)throw Error('PROTOCOL_CHANGED');accept(next);
 },[initial.gameId,initial.prepareNew,runId,accept]);
 useEffect(()=>{let stopped=false,timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
  const poll=async()=>{try{await refresh(controller.signal);}catch{if(!stopped)setConnected(false);}if(!stopped)timer=setTimeout(poll,1500);};void poll();
  return()=>{stopped=true;controller.abort();clearTimeout(timer);};
 },[refresh]);
 const live=data.live,round=live?currentEventRound(live.state):null;
 const numeric=Number(number),validNumber=number!==''&&Number.isInteger(numeric)&&numeric>=1&&numeric<=75&&!round?.draws.some(d=>d.number===numeric);
 const active=live?.state.run.status==='RUNNING'&&!live.between,ended=live?.state.run.status==='ENDED';
 const disabled=!connected||data.archived,callPending=[...busy].some(key=>key.startsWith('call-'));
 function command(c:EventCommand):Input{if(!live)throw Error('NO_RUN');return{operation:'command',gameId:data.gameId,runId:live.id,requestId:crypto.randomUUID(),revision:live.revision,command:c};}
 async function submit(input:Input,key:string){
  if(inflight.current.has(key))return;inflight.current.add(key);setBusy(new Set(inflight.current));
  try{
   const result=await saveEventRun(input);
   setRetries(old=>old.filter(r=>r.requestId!==input.requestId));
   if(!result.success){setMessage(result.message);await refresh();return;}
   setMessage('Gespeichert.');
   if(input.operation==='start'&&'runId' in result){router.replace(`/bingo/${data.gameId}/moderation?run=${result.runId}`);router.refresh();return;}
   if(input.operation==='command'){
    if(input.command.kind==='draw')setNumber('');
    if(input.command.kind==='correct'){setReplacement('');setCorrectionReason('');setSelectedDraw('');}
    if(input.command.kind==='target')setTarget('');
    if(['closeRound','startRound','end'].includes(input.command.kind)){setNumber('');setTarget('');setSelectedDraw('');setReplacement('');setCorrectionReason('');setDrafts({});}
    if(input.command.kind==='identify'||input.command.kind==='decide'){const id=input.command.callId;setDrafts(old=>({...old,[id]:{card:'',reason:''}}));}
   }
   await refresh();
  }catch{setConnected(false);setMessage('Speicherergebnis unbekannt. Verbindung prüfen und dieselbe Anfrage erneut senden.');setRetries(old=>old.some(r=>r.requestId===input.requestId)?old:[...old,input]);}
  finally{inflight.current.delete(key);setBusy(new Set(inflight.current));}
 }
 function send(c:EventCommand,key:string=c.kind){void submit(command(c),key);}
 function confirm(title:string,c:EventCommand){setConfirmation({title,input:command(c)});}
 const next=data.plan.find(p=>!live?.state.frozen.some(f=>f.id===p.round_id));
 const nextRound=data.rounds.find(r=>r.id===next?.round_id);
 const last=round?.draws.at(-1),style={'--bingo-yellow':PHIL_GUD.colors.yellow,'--bingo-pink':PHIL_GUD.colors.pink,'--bingo-ink':PHIL_GUD.colors.ink,'--bingo-paper':PHIL_GUD.colors.paper} as CSSProperties;
 const calls=live?.state.calls.filter(c=>c.roundId===round?.id)??[];
 return <main className={styles.root} style={style}>
  <header className={styles.header}><div><Link href={`/bingo/${data.gameId}`}>← Vorbereiten</Link><h1>{data.title}</h1><p>{live?`${live.round.label} · ${ended?'Beendet':live.between?'Zwischen den Runden':active?'Läuft':'Pause'}`:'Bereit zum Start'} · Zahlen-Bingo 75</p>{live&&<p className={styles.hint}>Aktiv: Runde {Math.floor(live.roundElapsedMs/60000)}:{String(Math.floor(live.roundElapsedMs/1000)%60).padStart(2,'0')} · Event {Math.floor(live.elapsedMs/60000)}:{String(Math.floor(live.elapsedMs/1000)%60).padStart(2,'0')}</p>}</div><nav><Link href={`/bingo/${data.gameId}/praesentation`} target="_blank" rel="noopener">Präsentation öffnen ↗</Link><Link href="/events">Alle Events</Link></nav></header>
  {!connected&&<p role="alert" className={styles.error}>Verbindung unterbrochen. Angezeigt wird der letzte bestätigte Stand. Schreibaktionen sind gesperrt.</p>}
  {data.archived&&<p role="status">Archivierte Eventreihe · nur Lesen.</p>}
  {message&&<p role="status">{message}</p>}
  {retries.map(input=><button key={input.requestId} disabled={busy.has(input.requestId)} onClick={()=>void submit(input,input.requestId)}>Unbestätigte Anfrage erneut senden</button>)}
  {!live?<section className={styles.panel}><h2>Durchlauf vorbereiten</h2><p>{data.rounds.length} geplante Runden · Karten werden ausdrücklich in der Vorbereitung zugeordnet.</p><button className={styles.primary} disabled={disabled||busy.size>0||!data.rounds[0]?.series.length} onClick={()=>setConfirmation({title:'Erste Runde starten?',input:{operation:'start',gameId:data.gameId,requestId:crypto.randomUUID(),expectedSeriesId:data.seriesId,preparationRevision:data.preparationRevision}})}>Erste Runde starten</button><Link href={`/bingo/${data.gameId}`}>Vorbereitung und Karten</Link></section>:<div className={styles.layout}>
   
    {!ended&&<section className={styles.panel}><div className={styles.actions}>
     <button disabled={disabled||busy.size>0||live.between} onClick={()=>confirm(active?'Runde pausieren?':'Runde fortsetzen?',{kind:active?'pause':'resume'})}>{active?'Pausieren':'Fortsetzen'}</button>
     <button disabled={disabled||busy.size>0||live.between||live.blocked} onClick={()=>confirm('Aktuelle Runde abschließen? Abgeschlossene Runden sind nicht korrigierbar. Ungespeicherte Rundeneingaben werden verworfen.',{kind:'closeRound'})}>Runde abschließen</button>
     <button disabled={disabled||busy.size>0||live.blocked||prepDirty.size>0||prepBusy.size>0} onClick={()=>confirm('Event abschließen? Dieser Durchlauf wird endgültig beendet. Ungespeicherte Rundeneingaben werden verworfen.',{kind:'end'})}>Event abschließen</button>
    </div></section>}
    {!ended&&!live.between&&<section className={`${styles.panel} ${styles.publishPanel}`}><h2>Zahl veröffentlichen</h2><form className={styles.publish} onSubmit={e=>{e.preventDefault();send({kind:'draw',number:Number(number)});}}><label>Neue Zahl<input value={number} onChange={e=>setNumber(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();e.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();}}} type="number" min="1" max="75" required disabled={disabled||!active||busy.has('draw')||callPending||live.blocked}/></label><button className={styles.primary} type="submit" disabled={disabled||!active||busy.has('draw')||callPending||live.blocked||!validNumber}>Zahl veröffentlichen</button><div aria-live="polite" className={styles.current}><span>Aktuelle Zahl</span><strong>{last?.number??'–'}</strong></div></form>
     {number&&!validNumber&&<p role="alert">Bitte eine noch nicht gezogene ganze Zahl von 1 bis 75 eingeben.</p>}<p className={styles.hint}>Enter in der Zahleneingabe fokussiert „Zahl veröffentlichen“.</p>
     {live.blocked&&<p role="status">Offene Rufe oder erforderliche Nachprüfungen: weitere Zahlen sind gesperrt. Weitere Rufe bleiben möglich.</p>}
     <div className={styles.calls}>{stages.map(([stage,label])=><button className={styles.call} key={stage} disabled={disabled||!active||busy.has(`call-${stage}`)} onClick={()=>send({kind:'call',stage,context:live.callContext},`call-${stage}`)}>{label}</button>)}</div>
    </section>}
    {live.between&&!ended&&<section className={styles.panel}><h2>Runde abgeschlossen</h2><p>{nextRound?`Als Nächstes: ${nextRound.label}`:'Alle geplanten Runden sind abgeschlossen.'}</p>{nextRound&&<button className={styles.primary} disabled={disabled||busy.size>0||prepDirty.size>0||prepBusy.size>0||!nextRound.series.length} onClick={()=>confirm(`${nextRound.label} starten?`,{kind:'startRound',roundId:nextRound.id,preparationRevision:data.preparationRevision})}>Nächste Runde starten</button>}</section>}
   <aside className={styles.panel}><h2>Rufe und Kartenprüfung</h2>{!calls.length&&<p>Noch keine Rufe in dieser Runde.</p>}{calls.map(call=>{const claim=round!.claims.find(c=>c.id===call.id),card=live.cards.find(c=>c.id===call.cardId),evaluation=claim&&card?evaluateClaim(round!,claim,card):null,draft=drafts[call.id]??{card:'',reason:''},decision=claim?.decisions.at(-1);const update=(value:Partial<typeof draft>)=>setDrafts(old=>({...old,[call.id]:{...draft,...value}}));return <section key={call.id} className={styles.claim}><h3>{stages.find(s=>s[0]===call.stage)?.[1]} · Ruf nach Ziehung {call.throughPosition}</h3><p>{claim?.needsReview?'Nachprüfung erforderlich':decision?{CONFIRM:'Bestätigt',REJECT:'Abgelehnt',REVOKE:'Widerrufen'}[decision.action]:'Offen'}</p>{!call.cardId?<form onSubmit={e=>{e.preventDefault();const card=live.cards.find(c=>[c.id,c.code,c.shortCode].some(code=>code.toUpperCase()===draft.card.trim().toUpperCase()));if(!card){setMessage('Keine zugeordnete Karte mit dieser vollständigen Kennung gefunden.');return;}send({kind:'identify',callId:call.id,cardId:card.id},call.id);}}><label>Kartenkennung<input required value={draft.card} onChange={e=>update({card:e.target.value})}/></label><button disabled={disabled||ended||busy.has(call.id)}>Karte prüfen</button></form>:<><p>{card?.shortCode} · {card?.code}</p><table aria-label={`Geprüfte Karte ${card?.shortCode}`} className={styles.card}><tbody>{card?.cells.map((row,i)=><tr key={i}>{row.map((n,j)=><td key={j} style={{fontWeight:n===null||round!.draws.slice(0,call.throughPosition).some(d=>d.number===n)?900:400}}>{n??'Frei'}</td>)}</tr>)}</tbody></table><p>Aktuelle Prüfung an der Rufgrenze: {evaluation?.stages.includes(call.stage)?'Gewinnstufe erfüllt':'Gewinnstufe nicht erfüllt'} · {evaluation?.lines.join(', ')||'keine Linien'}</p><p>Gewinnstufen zum Rufzeitpunkt: {claim?.originalEvaluation.stages.join(', ')||'Keine'}</p><label>Begründung<input maxLength={1000} value={draft.reason} onChange={e=>update({reason:e.target.value})}/></label><div className={styles.actions}>{(['CONFIRM','REJECT','REVOKE'] as const).map(action=><button key={action} disabled={disabled||ended||busy.has(call.id)||!draft.reason.trim()} onClick={()=>confirm(`${{CONFIRM:'Gewinn bestätigen',REJECT:'Ruf ablehnen',REVOKE:'Bestätigung widerrufen'}[action]}?`,{kind:'decide',callId:call.id,action,reason:draft.reason})}>{{CONFIRM:'Bestätigen',REJECT:'Ablehnen',REVOKE:'Widerrufen'}[action]}</button>)}</div></>}</section>;})}</aside>
    <section className={styles.panel}><h2>Gezogene Zahlen · {round!.draws.length} / {round!.plannedDraws}</h2><div className={styles.board}>{Array.from({length:75},(_,i)=>i+1).map(n=>{const d=round!.draws.find(d=>d.number===n);return <button key={n} disabled={!d||disabled||ended||live.between} aria-label={`${n}${last?.number===n?' · aktuelle Zahl':d?' · gezogen':' · noch nicht gezogen'}`} aria-pressed={Boolean(d&&selectedDraw===d.id)} className={last?.number===n?styles.latest:d?styles.drawn:styles.undrawn} onClick={()=>d&&setSelectedDraw(d.id)}>{n}</button>;})}</div>
     {!ended&&!live.between&&<details><summary>Frühere Ziehung korrigieren / Ziehungsziel ändern</summary><form onSubmit={e=>{e.preventDefault();confirm('Diese frühere Ziehung korrigieren? Bestätigte Gewinne werden gegebenenfalls zur Nachprüfung markiert.',{kind:'correct',drawId:selectedDraw,number:Number(replacement),reason:correctionReason});}}><label>Ziehung<select value={selectedDraw} required onChange={e=>setSelectedDraw(e.target.value)}><option value="">Ziehung auswählen …</option>{round!.draws.map((d,i)=><option key={d.id} value={d.id}>{i+1}. Ziehung · {d.number}</option>)}</select></label><label>Richtige Zahl<input required type="number" min="1" max="75" value={replacement} onChange={e=>setReplacement(e.target.value)}/></label><label>Begründung<input required maxLength={1000} value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)}/></label><button disabled={disabled||busy.size>0}>Korrektur prüfen</button></form><form onSubmit={e=>{e.preventDefault();send({kind:'target',number:Number(target)});}}><label>Geplante Ziehungen<input required min={Math.max(1,round!.draws.length)} max="75" type="number" value={target} onChange={e=>setTarget(e.target.value)}/></label><button disabled={disabled||busy.size>0}>Ziehungsziel speichern</button></form></details>}
     <details><summary>Ziehungs- und Korrekturhistorie</summary><ol aria-label="Ziehungshistorie">{round!.draws.map(d=><li key={d.id}>{d.position}. Ziehung: {d.number}</li>)}</ol>{round!.corrections.map(c=><p key={c.id}>Korrektur {c.position}: {c.before} → {c.after} · {c.reason}</p>)}</details>
    </section>
    {!ended&&<section className={styles.panel}><button disabled={disabled} onClick={()=>{if(extraOpen&&prepDirty.size&&!window.confirm("Ungespeicherte Rundeneingaben verwerfen?"))return;setExtraOpen(v=>!v);}}>Zusatzrunde vorbereiten</button>{extraOpen&&<><form onSubmit={e=>{e.preventDefault();send({kind:'appendRound',label:extraLabel,target:30,preparationRevision:data.preparationRevision});}}><label>Bezeichnung<input required maxLength={80} value={extraLabel} onChange={e=>setExtraLabel(e.target.value)}/></label><button disabled={disabled||busy.size>0||prepDirty.size>0||prepBusy.size>0}>Zusatzrunde anlegen</button></form><div className={styles.preparation}>{data.preparation.rounds.filter(r=>!live.state.frozen.some(f=>f.id===r.id)).map(r=><RoundEditor key={r.id} round={r} data={data.preparation} onDirty={trackDirty} onBusy={trackBusy} externallyBlocked={disabled||busy.size>0||[...prepDirty,...prepBusy].some(id=>id!==r.id)}/>)}</div></>}</section>}
    <section className={styles.panel}>{ended&&<Link href={`/bingo/${data.gameId}/moderation?new=1`}>Neuen Eventdurchlauf vorbereiten</Link>}<h2>{ended?'Abschlussübersicht':'Rundenübersicht'}</h2>{live.summary.map(s=><p key={s.id}>{s.label} · {s.draws} Ziehungen · {s.confirmed} bestätigte Gewinne · {Math.floor(s.activeMs/60000)}:{String(Math.floor(s.activeMs/1000)%60).padStart(2,'0')} aktiv</p>)}</section>

  </div>}
  <details><summary>Gespeicherte Durchläufe</summary>{data.runs.map(r=><p key={r.id}><Link href={`?run=${r.id}`}>{new Date(r.startedAt).toLocaleString("de-DE")} · {r.status}</Link></p>)}</details>
  <Modal className={styles.dialog} open={Boolean(confirmation)} title={confirmation?.title??''} onClose={()=>setConfirmation(null)} footer={<div className={styles.actions}><button onClick={()=>setConfirmation(null)}>Abbrechen</button><button disabled={busy.size>0||disabled} onClick={()=>{const value=confirmation;setConfirmation(null);if(value)void submit(value.input,value.input.requestId);}}>Bestätigen</button></div>}><p>Die Aktion gilt für den angezeigten Stand. Zwischenzeitliche Änderungen werden als Konflikt gemeldet.</p></Modal>
 </main>;
}
