"use client";
import {useState,useTransition,useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {Button} from '@/components/ui';
import {getBingoPrintPreview,confirmBingoRedesign} from './printActions';
import PrintPreview,{type PreviewResult} from './PrintPreview';
const subscribeToClient=()=>()=>{};
export default function RedesignPanel({gameId,seriesId,revision}:{gameId:string;seriesId:string;revision:number}){
 const ready=useSyncExternalStore(subscribeToClient,()=>true,()=>false);
 const [preview,setPreview]=useState<PreviewResult|null>(null),[confirmed,setConfirmed]=useState(false),[message,setMessage]=useState(''),[pending,start]=useTransition(),router=useRouter();
 return <section className="space-y-4 rounded-xl border bg-white p-4"><p>Karte, Zahlen, Kurzkennung, Runden und Ausgabe bleiben unverändert. Die bisherige Druckversion bleibt exportierbar.</p><Link href={`/bingo/${gameId}/design/druck`} className="inline-flex min-h-11 items-center underline">Druckeinstellungen bearbeiten</Link><div><Button type="button" disabled={!ready||pending} onClick={()=>start(async()=>{setConfirmed(false);setPreview(null);const r=await getBingoPrintPreview({target:{kind:'BINGO',id:gameId},seriesId});if(r.success){setPreview(r);setMessage('Aktuelle gespeicherte Druckgestaltung für diese Serie. Noch keine neue Version angelegt.');}else setMessage(r.message);})}>Druckvorschau aktualisieren</Button></div><PrintPreview preview={preview}/>{preview&&<><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={!ready||pending}/>Diese Gestaltung bewusst als neue Druckversion dieser Serie speichern</label><Button type="button" disabled={!ready||pending||!confirmed} onClick={()=>start(async()=>{const r=await confirmBingoRedesign({gameId,seriesId,expectedRevision:revision,previewHash:preview.hash,confirmed});if(r.success){router.push(`/bingo/${gameId}/karten?series=${seriesId}&version=${r.version}`);}else setMessage(r.message);})}>Neue Druckversion bestätigen</Button></>}{message&&<p role="status">{message}</p>}</section>;
}
