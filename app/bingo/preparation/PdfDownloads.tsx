'use client';
import { useRef,useState } from 'react';
import { exportParts } from './printFormats';
import { Button } from '@/components/ui';
export default function PdfDownloads({gameId,series,version=1}:{gameId:string;series:{id:string;code:string;count:number;duplex?:boolean}[];version?:number}){
 const [mode,setMode]=useState(series.every(s=>s.duplex)?'duplex':'front'),[message,setMessage]=useState(''),[pending,setPending]=useState(false),busy=useRef(false);
 const jobs=series.flatMap(s=>exportParts(s.count).map(range=>({href:`/bingo/${gameId}/karten/${s.id}/pdf?from=${range.from}&to=${range.to}&version=${version}&mode=${mode}`,name:`${s.code}-${range.from}-${range.to}-v${version}-${mode}.pdf`,...range,code:s.code})));
 const count=series.reduce((n,s)=>n+s.count,0);
 async function download(){
  if(busy.current)return;busy.current=true;setPending(true);
  try{for(const [index,job] of jobs.entries()){
    setMessage(`PDF ${index+1} von ${jobs.length} wird geladen …`);
    const response=await fetch(job.href,{credentials:'same-origin'});if(!response.ok)throw Error(`PDF ${index+1} fehlgeschlagen: ${await response.text()}`);
    const blob=await response.blob();if(!blob.type.includes('application/pdf'))throw Error(`PDF ${index+1}: ungültige Antwort.`);
    const href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download=job.name;link.click();setTimeout(()=>URL.revokeObjectURL(href),60000);
  }setMessage(`${jobs.length} PDF-Dateien vollständig an den Browser übergeben. Falls Mehrfachdownloads blockiert sind, die einzelnen Links verwenden. Keine Karten wurden gekürzt.`);}
  catch(error){setMessage(error instanceof Error?error.message:'Download fehlgeschlagen. Bereits geladene Dateien bleiben erhalten.');}
  finally{busy.current=false;setPending(false);}
 }
 return <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer py-2">Alle Karten als aufgeteilte PDFs herunterladen</summary><p className="text-sm">{count} unterschiedliche Karten · {count} Druckexemplare bei einmaligem Druck · keine zusätzlichen Kopien im PDF. Weitere Exemplare entstehen nur durch die Kopienzahl im Druckdialog. Druckstand: Version {version}.</p><label className="block text-sm">Druckmodus<select className="ml-2 min-h-11 rounded border bg-white px-3" disabled={pending} value={mode} onChange={e=>setMode(e.target.value)}>{series.every(s=>s.duplex)&&<option value="duplex">Duplex · lange Kante</option>}<option value="front">Nur Vorderseiten</option></select></label>{mode==='front'&&<p className="text-sm">Bei V3 steht die Kennung ausschließlich auf der Rückseite; ein reiner Vorderseitendruck enthält keine Kennung.</p>}<Button type="button" disabled={pending||!jobs.length} onClick={download}>{pending?'PDFs werden geladen …':`${jobs.length} PDF-Dateien herunterladen`}</Button>{message&&<p role="status">{message}</p>}<ul className="mt-2 space-y-2 text-sm">{jobs.map(job=><li key={job.href}><a href={job.href} download className="inline-flex min-h-11 items-center underline">{job.code} · Karten {job.from}–{job.to}</a></li>)}</ul></details>;
}
