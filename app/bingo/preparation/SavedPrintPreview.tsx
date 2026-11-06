'use client';
import { useState,useTransition } from 'react';
import { Button,Input } from '@/components/ui';
import PrintPreview,{type PreviewResult} from './PrintPreview';
import { getStoredPrintPreview } from './storedPrintActions';
export default function SavedPrintPreview({gameId,seriesId,version,count}:{gameId:string;seriesId:string;version:number;count:number}){
 const [ordinal,setOrdinal]=useState('1'),[preview,setPreview]=useState<PreviewResult|null>(null),[message,setMessage]=useState(''),[pending,start]=useTransition();
 return <section className="space-y-3 rounded-lg border bg-white p-4" aria-label="Gespeicherten Druckstand prüfen"><h2>Druckvorschau · Version {version}</h2><p className="text-sm">Liest gespeicherte Karten und den gewählten Druckstand unverändert. Keine neue Druckversion, keine Kartenänderung.</p><form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();start(async()=>{const result=await getStoredPrintPreview({gameId,seriesId,version,ordinal:Number(ordinal)});if(result.success){setPreview(result);setMessage(`Gespeicherter Druckstand ab Karte ${ordinal}.`);}else setMessage(result.message);});}}><label>Vorschau ab Karte<Input type="number" min={1} max={count} required value={ordinal} onChange={e=>{setOrdinal(e.target.value);setPreview(null);}} disabled={pending}/></label><Button type="submit" disabled={pending}>{pending?'PDF wird erzeugt …':'Gespeicherte Druckvorschau öffnen'}</Button></form>{message&&<p role="status">{message}</p>}<PrintPreview preview={preview}/></section>;
}
