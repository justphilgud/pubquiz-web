'use client';
import {useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Input} from '@/components/ui';
import {auditStoredCards} from './auditActions';
import {savePreparation} from './actions';
import type {PreparationView} from './policy';
import type {readEveningJobs} from './eveningPrint.server';

export default function EveningPrintPanel({data,jobs}:{data:PreparationView;jobs:Awaited<ReturnType<typeof readEveningJobs>>['jobs']}) {
  const router=useRouter(),[count,setCount]=useState('100'),[pending,start]=useTransition(),[message,setMessage]=useState('');
  const [audit,setAudit]=useState('');
  const request=useRef<{count:string;id:string}|null>(null),busy=useRef(false);
  const renderJob=(job:typeof jobs[number])=><article key={job.id} className="space-y-2 rounded-lg border p-4"><h3>{new Date(job.createdAt).toLocaleString('de-DE')} · {job.cards_per_round} Karten je Runde</h3><p className="break-all text-xs">{job.id}</p><ul>{job.items.map(i=><li key={i.series_id}>Runde {i.round_position} · {i.round_label} · {i.special?'Spezial':'Standard'} · {i.card_count} Karten · <a className="underline" href={`/bingo/${data.gameId}/karten?series=${i.series_id}`}>{i.code}</a></li>)}</ul><a download className="inline-flex min-h-11 items-center underline" href={`/bingo/${data.gameId}/karten/abend-pdf?job=${job.id}`}>Gesamten Abend als eine Duplex-PDF herunterladen</a></article>;
  return <section className="space-y-4 rounded-xl border p-5" aria-label="Druck für den gesamten Bingo-Abend"><h2>Gesamter Abend · {data.title}</h2><p>Neue unabhängige Karten je konfigurierter Runde. Spezialrunden erhalten ihre gespeicherte Zuordnung. Frühere Serien und Zuordnungen bleiben erhalten; nichts wird ersetzt oder gelöscht.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();if(busy.current)return;if(!window.confirm(`${count} neue Karten je Runde erzeugen? Vorhandene Serien bleiben zusätzlich zugeordnet. Der Druckauftrag enthält nur die neu erzeugten Serien.`))return;busy.current=true;start(async()=>{try{if(!request.current||request.current.count!==count)request.current={count,id:crypto.randomUUID()};const result=await savePreparation({operation:'generateEvening',gameId:data.gameId,expectedSeriesId:data.seriesId,revision:data.revision,count:Number(count),requestId:request.current.id});if(!result.success){setMessage(result.message);return;}setMessage('Druckauftrag vollständig erzeugt.');request.current=null;router.refresh();}catch{setMessage('Ergebnis unbekannt. Mit unveränderter Eingabe erneut versuchen; dieselbe Anfrage wird wiederholt.');}finally{busy.current=false;}});}}><label>Karten pro Runde<Input type="number" required min={1} max={1000} value={count} onChange={e=>setCount(e.target.value)}/></label><Button disabled={pending||data.archived}>{pending?'Wird erzeugt …':'Karten für alle Runden erzeugen'}</Button></form>{message&&<p role="status">{message}</p>}
    <Button variant="secondary" disabled={pending} onClick={()=>start(async()=>{const result=await auditStoredCards(data.gameId);setAudit(result.success?`${result.total} gespeicherte Karten geprüft · ${result.invalid} fehlerhaft. ${result.examples.length?'Betroffen: '+result.examples.join(', '):'Spaltenbereiche B/I/N/G/O, Freifeld, Dubletten und Integrität korrekt.'}`:result.message);})}>Gespeicherte Karten nur lesend prüfen</Button>{audit&&<p role="status">{audit}</p>}
    {jobs[0]&&<><h3>Neuester Druckauftrag für diesen Abend</h3>{renderJob(jobs[0])}</>}
    {jobs.length>1&&<details><summary className="min-h-11 cursor-pointer">Frühere Druckaufträge · Historie ({jobs.length-1})</summary>{jobs.slice(1).map(renderJob)}</details>}
  </section>;
}
