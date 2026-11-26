"use client";
import CeremonyControls from "../CeremonyControls";
import HistoricalCalls from "./HistoricalCalls";
import CardChecksPanel from './CardChecksPanel';
import DrawCorrection from './DrawCorrection';
import LiveTimes from './LiveTimes';
import {roundColor} from "../roundColors";
import {bingoStatistics} from './statistics';
import {bingoNumber,parseNumberInput} from './numberDisplay';
import { termFor } from "../preparation/termSet";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import {useRouter} from "next/navigation";
import {Modal} from "@/components/ui";
import {PHIL_GUD} from "@/app/branding/philGud";
import {useContentNavigationGuard} from "@/app/components/content/useContentNavigationGuard";
import {RoundEditor} from "../preparation/PreparationPanel";

import {currentEventRound,type EventCommand} from "./eventRun";
import type {EventModerationView} from "./eventRepository.server";
import {saveEventRun} from "./actions";
import {createLiveViewReader} from "./liveViewReader";
import styles from "./EventModerationPanel.module.css";
import MatchingModeration from './MatchingModeration';
type Input=Parameters<typeof saveEventRun>[0];
const stages=[['BINGO','Bingo'],['DOUBLE','Doppel-Bingo'],['TRIPLE','Triple-Bingo']] as const;
export default function EventModerationPanel({initial}:{initial:EventModerationView}){
 const router=useRouter(),[data,setData]=useState(initial),current=useRef(initial);
 const [connected,setConnected]=useState(true),[message,setMessage]=useState(''),[number,setNumber]=useState('');
 const [,setDrafts]=useState<Record<string,{card:string;reason:string}>>({});
 const [target,setTarget]=useState(''),[extraLabel,setExtraLabel]=useState('Zusatzrunde'),[extraOpen,setExtraOpen]=useState(false);
 const [busy,setBusy]=useState<Set<string>>(new Set()),inflight=useRef(new Set<string>()),[retries,setRetries]=useState<Input[]>([]);
 const [confirmation,setConfirmation]=useState<{title:string;input:Input}|null>(null);
 const [prepDirty,setPrepDirty]=useState<Set<string>>(new Set()),[prepBusy,setPrepBusy]=useState<Set<string>>(new Set());
 const trackDirty=useCallback((id:string,value:boolean)=>setPrepDirty(s=>{const n=new Set(s);if(value)n.add(id);else n.delete(id);return n;}),[]);
 const trackBusy=useCallback((id:string,value:boolean)=>setPrepBusy(s=>{const n=new Set(s);if(value)n.add(id);else n.delete(id);return n;}),[]);
 useContentNavigationGuard(Boolean(number||target||prepDirty.size));
 const runId=initial.live?.id;
 const accept=useCallback((next:EventModerationView)=>{
  const old=current.current.live,fresh=next.live;
  if(old&&(!fresh||fresh.id!==old.id||fresh.revision<old.revision))return;
  current.current=next;setData(next);setConnected(true);
 },[]);
 const url=`/api/bingo/live/${initial.gameId}${runId?`?run=${runId}`:initial.prepareNew?'?new=1':''}`;
 const reader=useMemo(()=>createLiveViewReader<EventModerationView>(url),[url]);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const next=await reader.read(signal);
  if(next.protocol!==2)throw Error('PROTOCOL_CHANGED');if(!signal?.aborted)accept(next);
 },[reader,accept]);
 useEffect(()=>{let stopped=false,timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
  const poll=async()=>{try{await refresh(controller.signal);}catch{if(!stopped)setConnected(false);}if(!stopped)timer=setTimeout(poll,1500);};void poll();
  return()=>{stopped=true;controller.abort();reader.cancel();clearTimeout(timer);};
 },[refresh,reader]);
 const live=data.live,round=live?currentEventRound(live.state):null;
 const stats=useMemo(()=>bingoStatistics(live?.cards??[],round?.draws??[]),[live?.cards,round?.draws]);
 const numeric=parseNumberInput(number),validNumber=numeric!==null&&!round?.draws.some(d=>d.number===numeric);
 const active=live?.state.run.status==='RUNNING'&&!live.between,ended=live?.state.run.status==='ENDED';
 const disabled=!connected||data.archived,callPending=[...busy].some(key=>key.startsWith('call-'));
 function command(c:EventCommand):Input{if(!live)throw Error('NO_RUN');return{operation:'command',gameId:data.gameId,runId:live.id,requestId:crypto.randomUUID(),revision:live.revision,command:c};}
 async function submit(input:Input,key:string){
  if(inflight.current.has(key))return;inflight.current.add(key);setBusy(new Set(inflight.current));
  try{
   const result=await saveEventRun(input);
   setRetries(old=>old.filter(r=>r.requestId!==input.requestId));
   if(!result.success){setMessage(result.message);await refresh();return false;}
   setMessage('Gespeichert.');
   if(input.operation==='start'&&'runId' in result){router.replace(`/bingo/${data.gameId}/moderation?run=${result.runId}`);router.refresh();return;}
   if(input.operation==='command'){
    if(input.command.kind==='draw')setNumber('');
    if(input.command.kind==='target')setTarget('');
    if(['closeRound','startRound','end'].includes(input.command.kind)){setNumber('');setTarget('');setDrafts({});}
    if(input.command.kind==='identify'||input.command.kind==='decide'){const id=input.command.callId;setDrafts(old=>({...old,[id]:{card:'',reason:''}}));}
   }
   await refresh();return true;
  }catch{setConnected(false);setMessage('Speicherergebnis unbekannt. Verbindung prüfen und dieselbe Anfrage erneut senden.');setRetries(old=>old.some(r=>r.requestId===input.requestId)?old:[...old,input]);}
  finally{inflight.current.delete(key);setBusy(new Set(inflight.current));}
 }
 function send(c:EventCommand,key:string=c.kind){void submit(command(c),key);}
 function confirm(title:string,c:EventCommand){setConfirmation({title,input:command(c)});}
 const next=data.plan.find(p=>!live?.state.frozen.some(f=>f.id===p.round_id));
 const nextRound=data.rounds.find(r=>r.id===next?.round_id);
 const last=round?.draws.at(-1),style={'--bingo-yellow':PHIL_GUD.colors.yellow,'--bingo-pink':PHIL_GUD.colors.pink,'--bingo-ink':PHIL_GUD.colors.ink,'--bingo-paper':PHIL_GUD.colors.paper} as CSSProperties;
 const calls=live?.state.calls.filter(c=>c.roundId===round?.id)??[];
 const matchingPanel=live?.round.matching&&<MatchingModeration gameId={data.gameId} runId={live.id} number={validNumber?numeric:null} entry={live.matchingEntry} drawId={last?.id} publication={live.round.matching.publication} revealed={last?live.state.revealed?.includes(last.id)??false:false} disabled={disabled||busy.size>0||!active} onCommand={send}/>;
 const startButton=<button className={styles.primary} disabled={disabled||busy.size>0||!data.rounds[0]?.series.length} onClick={()=>setConfirmation({title:'Erste Runde starten?',input:{operation:'start',gameId:data.gameId,requestId:crypto.randomUUID(),expectedSeriesId:data.seriesId,preparationRevision:data.preparationRevision}})}>Erste Runde starten</button>;
 const summaryPanel=<section className={styles.panel}>{ended&&<Link href={`/bingo/${data.gameId}/moderation?new=1`}>Neuen Eventdurchlauf vorbereiten</Link>}<h2>{ended?'Abschlussübersicht':'Rundenübersicht'}</h2>{live?.summary.map(s=><p key={s.id}>{s.label} · {s.draws} Ziehungen · {s.confirmed} bestätigte Gewinne · {Math.floor(s.activeMs/60000)}:{String(Math.floor(s.activeMs/1000)%60).padStart(2,'0')} aktiv</p>)}</section>;
 const ceremonyPanel=<section className={styles.panel}><CeremonyControls gameId={data.gameId} state={data.ceremony} runId={live?.id} ended={Boolean(ended)} disabled={disabled||busy.size>0} onSaved={refresh} raffle={live?.raffle}/></section>;
 const savedRuns=<details><summary>Gespeicherte Durchläufe</summary>{data.runs.map(r=><p key={r.id}><Link href={`?run=${r.id}`}>{new Date(r.startedAt).toLocaleString("de-DE")} · {r.status}</Link></p>)}</details>;
 return <main className={styles.root} style={style}>
  <header className={styles.header}><div className={styles.title}><h1>{data.title}</h1><span className={styles.badge} style={{borderInlineStartColor:roundColor(Math.min(10,live?.state.run.rounds.length??1)).background,borderInlineStartWidth:8}}>{live?`${live.round.label} · ${ended?'Beendet':live.between?'Zwischen den Runden':active?'Läuft':'Pause'}`:'Bereit zum Start'}</span></div><nav>{!live&&startButton}<Link href={`/bingo/${data.gameId}/praesentation`} target="_blank" rel="noopener">Präsentation öffnen ↗</Link><Link href={`/bingo/${data.gameId}`}>← Vorbereiten</Link><Link href="/events">Alle Events</Link>{live&&!ended&&<details className={styles.more}><summary aria-label="Weitere Aktionen"><span>Weitere Aktionen</span></summary><button className={styles.danger} disabled={disabled||busy.size>0||live.blocked||prepDirty.size>0||prepBusy.size>0} onClick={()=>confirm('Event abschließen? Dieser Durchlauf wird endgültig beendet. Ungespeicherte Rundeneingaben werden verworfen.',{kind:'end'})}>Event abschließen</button></details>}</nav></header>
  {!connected&&<p role="alert" className={styles.error}>Verbindung unterbrochen. Angezeigt wird der letzte bestätigte Stand. Schreibaktionen sind gesperrt.</p>}
  {data.archived&&<p role="status">Archivierte Eventreihe · nur Lesen.</p>}
  {live?.raffle.overCapacity&&<p role="alert" className={styles.error}>Abschlussverlosung: Der benötigte Kugelbereich überschreitet 90. Eine alternative Ziehungsmethode muss fachlich abgestimmt werden; die Abschlussziehung ist gesperrt.</p>}
  {message&&<p role="status">{message}</p>}
  {retries.map(input=><button key={input.requestId} disabled={busy.has(input.requestId)} onClick={()=>void submit(input,input.requestId)}>Unbestätigte Anfrage erneut senden</button>)}
  {!live?<div className={styles.layout}><div className={styles.workspace}><section className={`${styles.panel} ${styles.central}`} aria-label="Zahlenarbeitsfläche"><h2>{data.rounds[0]?.label??'Durchlauf vorbereiten'}</h2><div className={styles.intermission}><h2>Bereit für Runde 1</h2><p>{data.rounds[0]?.series.length?'Die Karten sind vorbereitet. Starte das Bingo im Kopfbereich.':'Bitte zuerst Karten ausdrücklich in der Vorbereitung zuordnen.'}</p><Link href={`/bingo/${data.gameId}`}>Vorbereitung und Karten</Link></div></section><div className={styles.toolbar} aria-label="Hauptaktionen"><span>Kartenprüfung nach Rundenstart</span><button disabled>Pausieren</button></div></div><aside className={styles.sidebar} aria-label="Runden und Status"><section className={styles.panel}><h2>Runden</h2><p>{data.rounds.length} geplante Runden</p>{data.rounds.map(r=><p key={r.id}>{r.label} · {r.series.length?'Karten vorbereitet':'Karten fehlen'}</p>)}</section><section className={styles.panel}><h2>Zeit</h2><p>Noch nicht gestartet</p></section><section className={styles.panel}><h2>Verbindung</h2><p>{connected?'Verbunden':'Verbindung unterbrochen'}</p></section>{ceremonyPanel}{savedRuns}</aside></div>:<div className={styles.layout}>
   
    <div className={styles.workspace}><section className={`${styles.panel} ${styles.central}`} aria-label="Zahlenarbeitsfläche"><div className={styles.roundHeading}><h2>{live.round.label}</h2><span>{round!.draws.length} / {round!.plannedDraws} Ziehungen</span></div>    {!ended&&!live.between&&<div className={styles.publishPanel}><div className={styles.numberRow}><div aria-live="polite" className={styles.current}><span>Aktuelle Zahl</span><strong>{bingoNumber(last?.number)}</strong></div><form className={styles.publish} onSubmit={e=>{e.preventDefault();if(!validNumber||disabled||!active)return;if((live.round.matching?.publication??live.round.terms?.publication)==='APPROVAL')confirm('Begriff für das Publikum veröffentlichen?',{kind:'draw',number:Number(number)});else send({kind:'draw',number:Number(number)});}}><label>Neue Zahl<input value={number} onChange={e=>setNumber(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();e.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();}}} type="text" inputMode="numeric" pattern="[0-9]+" required disabled={disabled||!active||busy.has('draw')||callPending}/><span aria-live="polite">{bingoNumber(numeric)}</span></label><button className={styles.primary} type="submit" disabled={disabled||!active||busy.has('draw')||callPending||!validNumber}>Zahl veröffentlichen</button></form></div>
     {matchingPanel}{live.round.terms&&validNumber&&<p>Zuordnung: <strong>{termFor(live.round.terms,numeric!)}</strong>{live.round.terms.publication==='HIDDEN'?' · bis zur Auflösung verborgen':''}</p>}{live.round.terms&&last&&<p>Aktueller Begriff: <strong>{termFor(live.round.terms,last.number)}</strong>{live.round.terms.publication==='HIDDEN'&&!live.state.revealed?.includes(last.id)&&<button disabled={disabled||busy.size>0||live.between||ended} onClick={()=>send({kind:'reveal',drawId:last.id})}>Begriff auflösen</button>}</p>}{number&&!validNumber&&<p role="alert">Bitte eine noch nicht gezogene ganze Zahl von 1 bis 75 eingeben.</p>}<p className={styles.hint}>Enter in der Zahleneingabe fokussiert „Zahl veröffentlichen“.</p>
     {live.blocked&&<p role="status">Offene Rufe oder Nachprüfungen vorhanden. Weitere Ziehungen sind möglich; bei Bedarf manuell pausieren.</p>}
    </div>}
    {live.between&&!ended&&<div className={styles.intermission}><h2>Runde abgeschlossen</h2><p>{nextRound?`Als Nächstes: ${nextRound.label}`:'Alle geplanten Runden sind abgeschlossen.'}</p>{nextRound&&<button className={styles.primary} disabled={disabled||busy.size>0||prepDirty.size>0||prepBusy.size>0||!nextRound.series.length} onClick={()=>confirm(`${nextRound.label} starten?`,{kind:'startRound',roundId:nextRound.id,preparationRevision:data.preparationRevision})}>Nächste Runde starten</button>}</div>}
    {!ended&&!live.between&&<DrawCorrection key={round!.id} draws={round!.draws} disabled={disabled||busy.size>0} onCorrect={c=>confirm('Ziehung korrigieren? Prüfungen werden nachgerechnet; Gewinnentscheidungen bleiben erhalten.',c)}/>}
{ended&&<div className={styles.intermission}><h2>Bingo beendet</h2><p>Runden und Ergebnisse stehen rechts in der Abschlussübersicht.</p></div>}</section><CardChecksPanel gameId={data.gameId} runId={live.id} checks={(live.state.checks??[]).filter(c=>c.roundId===round?.id)} cards={live.checkCards} draws={round!.draws} claims={round!.claims} tickets={live.raffle.entries.filter(t=>t.roundId===round!.id)} onDecision={c=>confirm('Gewinnentscheidung für diese Prüfung speichern?',c)} disabled={disabled||live.between||Boolean(ended)||busy.size>0} onCheck={cardId=>submit(command({kind:'check',cardId,context:live.callContext}),'check')}/><HistoricalCalls state={live.state} round={round!} cards={live.cards} disabled={disabled||busy.size>0||Boolean(ended)} onCommand={c=>confirm('Entscheidung für früheren Ruf speichern?',c)}/>{!ended&&<div className={styles.toolbar} aria-label="Hauptaktionen">     <span>Karten direkt mit „Check“ prüfen</span><button className={styles.pause} disabled={disabled||busy.size>0||live.between} onClick={()=>confirm(active?'Runde pausieren?':'Runde fortsetzen?',{kind:active?'pause':'resume'})}>{active?'Pausieren':'Fortsetzen'}</button></div>}    {!ended&&<section className={styles.panel} hidden={!extraOpen}><button disabled={disabled||data.rounds.length>=10} onClick={()=>{if(extraOpen&&prepDirty.size&&!window.confirm("Ungespeicherte Rundeneingaben verwerfen?"))return;setExtraOpen(v=>!v);}}>Zusatzrunde schließen</button>{extraOpen&&<><form onSubmit={e=>{e.preventDefault();send({kind:'appendRound',label:extraLabel,target:30,preparationRevision:data.preparationRevision});}}><label>Bezeichnung<input required maxLength={80} value={extraLabel} onChange={e=>setExtraLabel(e.target.value)}/></label><button disabled={disabled||busy.size>0||prepDirty.size>0||prepBusy.size>0}>Zusatzrunde anlegen</button></form><div className={styles.preparation}>{data.preparation.rounds.filter(r=>!live.state.frozen.some(f=>f.id===r.id)).map(r=><RoundEditor key={r.id} round={r} data={data.preparation} onDirty={trackDirty} onBusy={trackBusy} externallyBlocked={disabled||busy.size>0||[...prepDirty,...prepBusy].some(id=>id!==r.id)}/>)}</div></>}</section>}
</div><aside className={styles.sidebar} aria-label="Runden und Status">{ended&&summaryPanel}<section className={styles.panel} aria-label="Live-Bingo-Wahrscheinlichkeit"><h2>Live-Statistik</h2><div className={styles.statistics}><span><strong>{stats.drawCount}</strong> Ziehungen</span><span><strong>{stats.waitingCards}</strong> Karten eine Zahl vor Bingo</span><span><strong>{stats.probability.toLocaleString('de-DE',{maximumFractionDigits:1})} %</strong> Chance bei der nächsten Ziehung</span></div><p className={styles.hint}>{stats.basis} ({stats.cardCount}). Tatsächlich ausgegebene Karten sind nicht einzeln bekannt.</p></section><section className={styles.panel}><h2>Runden</h2><p>Runde {live.state.run.rounds.length} von {data.plan.length}</p><p>{nextRound?`${nextRound.label} · ${nextRound.series.length?'Karten vorbereitet':'Karten fehlen'}`:'Keine weitere Runde geplant.'}</p>{!ended&&<div className={styles.actions}><button disabled={disabled||busy.size>0||live.between||live.blocked} onClick={()=>confirm('Aktuelle Runde abschließen? Abgeschlossene Runden sind nicht korrigierbar. Ungespeicherte Rundeneingaben werden verworfen.',{kind:'closeRound'})}>Runde abschließen</button><button disabled={disabled} onClick={()=>{if(extraOpen&&prepDirty.size&&!window.confirm("Ungespeicherte Rundeneingaben verwerfen?"))return;setExtraOpen(v=>!v);}}>Zusatzrunde vorbereiten</button></div>}</section><section className={styles.panel}><h2>Rufe</h2>{calls.length?calls.map((call,index)=>{const claim=round!.claims.find(c=>c.id===call.id),decision=claim?.decisions.at(-1),card=live.cards.find(c=>c.id===call.cardId);return <a key={call.id} className={styles.callLink} href={`#call-${call.id}`}>Ruf {index+1} · {stages.find(s=>s[0]===call.stage)?.[1]} · Ziehung {call.throughPosition} · {claim?.needsReview?'Nachprüfung':decision?{CONFIRM:'Bestätigt',REJECT:'Abgelehnt',REVOKE:'Widerrufen'}[decision.action]:'Offen'}{card?` · ${card.shortCode}`:''}</a>;}):<p>Noch kein Ruf erfasst.</p>}</section><section className={styles.panel}><h2>Zeit</h2><div className={styles.time}><LiveTimes sample={live} running={Boolean(active&&connected)}/></div></section><section className={styles.panel}><h2>Fortschritt</h2><p>{round!.draws.length} / {round!.plannedDraws} Ziehungen</p><progress aria-label="Fortschritt der geplanten Ziehungen" max={round!.plannedDraws} value={round!.draws.length}/><p className={styles.hint}>Kein automatisches Rundenende.</p></section><section className={styles.panel}><h2>Verbindung</h2><p>{connected?'Verbunden':'Verbindung unterbrochen'}</p></section><section className={styles.panel}>     {!ended&&!live.between&&<><details><summary>Ziehungsziel ändern</summary><form onSubmit={e=>{e.preventDefault();send({kind:'target',number:Number(target)});}}><label>Geplante Ziehungen<input required min={Math.max(1,round!.draws.length)} max="75" type="number" value={target} onChange={e=>setTarget(e.target.value)}/></label><button disabled={disabled||busy.size>0}>Ziehungsziel speichern</button></form></details></>}
     <details><summary>Ziehungs- und Korrekturhistorie</summary><ol aria-label="Ziehungshistorie">{round!.draws.map(d=><li key={d.id}>{d.position}. Ziehung: {bingoNumber(d.number)}</li>)}</ol>{round!.corrections.map(c=><p key={c.id}>Korrektur {c.position}: {bingoNumber(c.before)} → {bingoNumber(c.after)} · {c.reason} · {new Date(live.events.find(e=>e.id===c.id)?.at??live.serverAt).toLocaleString('de-DE')}</p>)}</details>
</section>{!ended&&summaryPanel}{ceremonyPanel}{savedRuns}</aside>

  </div>}
  <Modal className={styles.dialog} open={Boolean(confirmation)} title={confirmation?.title??''} onClose={()=>setConfirmation(null)} footer={<div className={styles.actions}><button onClick={()=>setConfirmation(null)}>Abbrechen</button><button disabled={busy.size>0||disabled} onClick={()=>{const value=confirmation;setConfirmation(null);if(value)void submit(value.input,value.input.requestId);}}>Bestätigen</button></div>}><p>Die Aktion gilt für den angezeigten Stand. Zwischenzeitliche Änderungen werden als Konflikt gemeldet.</p></Modal>
 </main>;
}
