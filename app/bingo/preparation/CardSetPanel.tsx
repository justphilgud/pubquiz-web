'use client';
import {useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Input} from '@/components/ui';
import {saveCardSet} from './cardSetActions';
import {cardQuantity,cardSetSummary,parseCardSetConfig} from './cardSet';
import type {readCardSet} from './cardSetRead.server';
import {cardSetSlot,cardSetCutMarks} from './cardSetGeometry';
type Data=Awaited<ReturnType<typeof readCardSet>>;
function quantityProblem(value:number,zero=false){try{cardQuantity(value,zero);return '';}catch(error){return error instanceof Error?error.message:'Ungültige Menge.';}}
export default function CardSetPanel({data}:{data:Data}){
 const [config,setConfig]=useState(data.config),[message,setMessage]=useState(''),[pending,start]=useTransition(),[extra,setExtra]=useState(10),[preview,setPreview]=useState<string|null>(null);
 const router=useRouter(),request=useRef<{body:string;id:string}|null>(null),busy=useRef(false);
 const summary=cardSetSummary(config),last=data.rounds.at(-1);
 let validation='';try{parseCardSetConfig(config);}catch(error){validation=error instanceof Error?error.message:'Ungültige Mengen.';}
 const act=(operation:'save'|'prepare'|'extra',roundId?:string,wildcard=false)=>{
  if(busy.current)return;
  if(operation==='extra'&&!window.confirm(`${extra} zusätzliche ${wildcard?'Wildcards':'Karten'} erzeugen? Vorhandene Karten bleiben erhalten.`))return;
  const payload={gameId:data.gameId,expectedSeriesId:data.seriesId,revision:data.revision,operation,config,...(operation==='extra'?{roundId,wildcard,count:extra}:{})};
  const body=JSON.stringify(payload);if(request.current?.body!==body)request.current={body,id:crypto.randomUUID()};
  busy.current=true;start(async()=>{try{
   const result=await saveCardSet({...payload,requestId:request.current!.id});
   if(!result.success){setMessage(result.message);return;}
   setMessage(operation==='save'?'Auswahl und Mengen gespeichert. Keine Karten erzeugt.':operation==='extra'?'Zusatzkarten gespeichert. Bitte Bestand neu laden.':'Kartensatz gespeichert. Erneute Downloads verwenden dieselben Karten.');
   request.current=null;if(result.setId)setPreview(result.setId);router.refresh();
  }catch{setMessage('Ergebnis unbekannt. Mit unveränderter Eingabe erneut versuchen; dieselbe Anfrage wird wiederholt.');}finally{busy.current=false;}});
 };
 return <section id="abendkartensatz" aria-labelledby="card-set-heading" className="space-y-5 rounded-xl border bg-white p-4 sm:p-6">
  <h2 id="card-set-heading">Kartensatz für den Bingo-Abend</h2>
  <p>Runden auswählen, Mengen prüfen und einen gemeinsamen Drucksatz vorbereiten. Die Auswahl allein erzeugt oder löscht keine Karten.</p>
  <fieldset disabled={pending||data.archived} className="min-w-0 space-y-4">
   <label className="block max-w-sm">Standardanzahl pro Runde<Input id="card-set-default" type="number" min={1} max={1000} value={config.defaultCount} onChange={e=>setConfig({...config,defaultCount:Number(e.target.value)})}/>{quantityProblem(config.defaultCount)&&<span role="alert" className="text-sm text-red-700">{quantityProblem(config.defaultCount)}</span>}</label>
   <p className="text-sm">Ohne eigene Menge gilt der Standard. Bereits angelegte Karten bleiben auch bei kleineren Mengen erhalten.</p>
   {data.rounds.map((r,index)=>{const plan=config.rounds.find(c=>c.id===r.id)!,count=plan.count??config.defaultCount;return <div key={r.id} data-card-set-round={r.id} className="space-y-2 rounded-lg border p-3">
    <label className="flex min-h-11 items-center gap-3"><input id={`card-set-selected-${r.id}`} type="checkbox" checked={plan.selected} onChange={e=>setConfig({...config,rounds:config.rounds.map(c=>c.id===r.id?{...c,selected:e.target.checked}:c)})}/><strong>Runde {index+1}: {r.label}</strong> · {r.special?'Themen-Bingo':'Zahlen-Bingo'}</label>
    <label className="block max-w-sm">Eigene Menge (leer = Standard)<Input id={`card-set-count-${r.id}`} type="number" min={1} max={1000} placeholder={String(config.defaultCount)} value={plan.count??''} onChange={e=>setConfig({...config,rounds:config.rounds.map(c=>c.id===r.id?{...c,count:e.target.value===''?null:Number(e.target.value)}:c)})}/>{plan.count!==null&&quantityProblem(plan.count)&&<span role="alert" className="text-sm text-red-700">{quantityProblem(plan.count)}</span>}</label>
    <p className="text-sm">{count} vorgesehen · {r.stock} angelegt{!plan.selected?' · nicht im Drucksatz; keine Erzeugung beim Vorbereiten':r.stock>=count?` · ${count} davon im Satz`:r.stock>0?` · ${count-r.stock} fehlen: ausdrücklich Zusatzkarten erzeugen`:' · werden beim ersten Vorbereiten angelegt'}</p>
    <Button type="button" variant="secondary" onClick={()=>act('extra',r.id)}>Zusatzkarten erzeugen · Runde {index+1}</Button>
   </div>;})}
   {!data.rounds.length&&<p role="note">Bitte zuerst eine Runde anlegen. Ohne letzte Runde sind keine Wildcards möglich.</p>}
   <div className="space-y-2 rounded-lg border p-3"><h3>Wildcards für die letzte Runde</h3><p className="text-sm">{last?`${last.label} · ${last.special?'mit deren Themenzuordnung':'Zahlen-Bingo'}`:'Keine letzte Runde vorhanden.'} · eigener WC-Code und Rückseite in STELP-Dunkelblau mit beiden Logos. Wildcards stehen im PDF am Ende.</p>
    <label className="block max-w-sm">Anzahl Wildcards<Input id="card-set-wildcards" type="number" min={0} max={1000} value={config.wildcards} onChange={e=>setConfig({...config,wildcards:Number(e.target.value)})}/>{quantityProblem(config.wildcards,true)&&<span role="alert" className="text-sm text-red-700">{quantityProblem(config.wildcards,true)}</span>}</label>
    <p>{config.wildcards} vorgesehen · {data.wildcardStock} angelegt. Angelegte Wildcards binden die letzte Runde; diese bleibt anschließend die letzte Runde.</p>
    <Button type="button" variant="secondary" disabled={!last} onClick={()=>act('extra',last?.id,true)}>Zusatzkarten erzeugen · Wildcards</Button>
   </div>
   <label className="block max-w-sm">Menge für den Zusatzschritt<Input id="card-set-extra" type="number" min={1} max={1000} value={extra} onChange={e=>setExtra(Number(e.target.value))}/>{quantityProblem(extra)&&<span role="alert" className="text-sm text-red-700">{quantityProblem(extra)}</span>}</label>
   {validation&&<p role="alert">{validation}</p>}
   <div className="rounded-lg bg-slate-50 p-3"><h3>Vor dem Vorbereiten prüfen</h3><ul>{summary.sections.map(s=><li key={s.id}>{data.rounds.find(r=>r.id===s.id)?.label}: {s.count} Karten</li>)}</ul><p>{config.wildcards} Wildcards · insgesamt {summary.cards} Karten · {summary.pages} Seiten ({summary.pages/2} Duplex-Bögen).</p><p>SRA3 320 × 450 mm · 12 Karten pro Bogen · Endformat 92,5 × 92,5 mm · gemeinsame Schnittkanten · 3 mm Außenanschnitt · 100 % · lange Kante.</p><p>Der gesamte Bogen einschließlich Stegen, Rändern und freien Plätzen ist beidseitig eingefärbt: hinten in der Rundenfarbe, vorne in der gespeicherten Karten-Hintergrundfarbe.</p></div>
   <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" disabled={Boolean(validation)} onClick={()=>act('save')}>Auswahl und Mengen speichern</Button><Button type="button" disabled={Boolean(validation)||!summary.cards} onClick={()=>act('prepare')}>Kartensatz vorbereiten</Button></div>
  </fieldset>
  {message&&<p role="status">{message}</p>}
  <details><summary className="min-h-11 cursor-pointer">Druckgeometrie ansehen: Endformat, Anschnitt und Schnittmarken</summary><p className="text-sm">Blau: Schnittkante/Endformat. Rosa: 3 mm Außenanschnitt um den Kartenblock. Innen teilen benachbarte Karten eine Schnittkante, ohne Zwischensteg. Schwarz gestrichelt: Ansatzmarken am äußeren Papierrand, rechtwinklig zur Papierkante. Die farbigen Hilfslinien erscheinen nur in dieser Vorschau.</p><svg viewBox="0 0 320 450" role="img" aria-label="SRA3 mit zwölf Karten, Anschnitt und außenliegenden Schnittmarken" className="mx-auto max-h-[600px] w-full max-w-md border bg-slate-100">{Array.from({length:12},(_,i)=>{const {trim:[x,y,w,h],bleed:[bx,by,bw,bh]}=cardSetSlot(i);return <g key={i}><rect x={bx} y={450-by-bh} width={bw} height={bh} fill="#f8c8dc"/><rect x={x} y={450-y-h} width={w} height={h} fill="white" stroke="#2563eb" strokeWidth=".4"/></g>;})}{cardSetCutMarks().map((m,i)=><line key={`mark-${i}`} x1={m.start[0]} y1={450-m.start[1]} x2={m.end[0]} y2={450-m.end[1]} stroke="black" strokeWidth=".25" strokeDasharray="1 .75"/>)}</svg></details>
  {data.sets.length>0&&<div className="space-y-3"><h3>Gespeicherte Kartensätze</h3>{data.sets.map(s=><article key={s.id} className="flex flex-wrap items-center gap-3 rounded border p-3"><span>{new Date(s.at).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})} · {s.cards} Karten · {s.pages} Seiten</span><a className="inline-flex min-h-11 items-center underline" download href={`/bingo/${data.gameId}/karten/kartensatz-pdf?set=${s.id}`}>SRA3-PDF herunterladen</a><Button type="button" variant="secondary" onClick={()=>setPreview(s.id)}>PDF-Vorschau</Button></article>)}</div>}
  {preview&&<div><h3>Gespeicherter Drucksatz · Vorschau</h3><p className="text-sm">Downloads und Vorschau erzeugen keine Karten. Für Druckerregistrierung einen Duplex-Testbogen bei 100 % drucken.</p><iframe title="SRA3-Kartensatz PDF-Vorschau" src={`/bingo/${data.gameId}/karten/kartensatz-pdf?set=${preview}`} className="h-[650px] w-full rounded border"/></div>}
 </section>;
}
