"use client";
import Link from "next/link";
import { useState,useTransition,useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useContentNavigationGuard } from "@/app/components/content/useContentNavigationGuard";
import { Button } from "@/components/ui";
import { printFormats,type PrintFormat } from './printFormats';
import { parseBingoPrint } from "@/app/bingo/preparation/bingoPrint";
import type { readPrintDesign } from "./printDesignRepository.server";
import PrintFields from "./PrintFields";
import PrintPreview,{type PreviewResult} from "./PrintPreview";
import {saveBingoPrint,getBingoPrintPreview} from './printActions';
const subscribeToClient=()=>()=>{};
export default function PrintDesignPanel({data,returnHref}:{data:Awaited<ReturnType<typeof readPrintDesign>>;returnHref:string}){
  const ready=useSyncExternalStore(subscribeToClient,()=>true,()=>false);
  const router=useRouter(),[value,setValue]=useState(data.settings),[templateId,setTemplateId]=useState(data.selection?.templateId??data.inheritedSelection?.templateId??''),[format,setFormat]=useState<PrintFormat>(data.selection?.format??data.inheritedSelection?.format??data.settings.layout?.format??'A4_FOUR'),[own,setOwn]=useState(data.own),[message,setMessage]=useState(''),[preview,setPreview]=useState<PreviewResult|null>(null),[pending,start]=useTransition();
  const selectedConfig=templateId?{version:2 as const,templateId,format}:value;
  const shownTemplateId=own?templateId:data.inheritedSelection?.templateId??'';
  const dirty=own!==data.own||(own&&(templateId!==(data.selection?.templateId??data.inheritedSelection?.templateId??'')||format!==(data.selection?.format??data.inheritedSelection?.format??data.settings.layout?.format??'A4_FOUR')||JSON.stringify(value)!==JSON.stringify(data.settings))),saved=useContentNavigationGuard(dirty),valid=parseBingoPrint(own?value:data.inherited);

  const change=(next:typeof value)=>{setValue(next);setPreview(null);};
  return <div className="space-y-5"><form className="space-y-4 rounded-xl border bg-white p-4" onSubmit={e=>{e.preventDefault();start(async()=>{const result=await saveBingoPrint({target:data.target,expectedStateHash:data.stateHash,config:own?selectedConfig:null});if(!result.success){setMessage(result.message);return;}saved();setMessage('Druckeinstellungen gespeichert. Bestehende Karten behalten ihre bisherige Druckversion.');router.refresh();});}}>
    <p role="status">{data.source} · {data.designName}</p><label className="flex min-h-11 items-center gap-3"><input id="print-override" type="checkbox" checked={own} disabled={!ready||!data.canWrite||pending} onChange={e=>{setOwn(e.target.checked);setPreview(null);}}/>Druckgestaltung ausdrücklich abweichend festlegen</label>
    <label className="block text-sm">Bingo-Druckvorlage<select aria-label="Bingo-Druckvorlage" className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3" value={shownTemplateId} disabled={!ready||!own||!data.canWrite||pending} onChange={e=>{setTemplateId(e.target.value);setPreview(null);}}><option value="">Bisherige individuelle Druckgestaltung</option>{data.templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    {shownTemplateId?<><label className="block text-sm">Papierformat und Kartenaufteilung<select aria-label="Papierformat und Kartenaufteilung" className="mt-1 min-h-11 w-full rounded border bg-white px-3" disabled={!ready||!own||!data.canWrite||pending} value={own?format:data.inherited.layout?.format??'A4_FOUR'} onChange={e=>{setFormat(e.target.value as PrintFormat);setPreview(null);}}>{Object.entries(printFormats).map(([id,f])=><option key={id} value={id}>{f.label}</option>)}</select></label><Link className="inline-flex min-h-11 items-center underline" href={`/templates/${shownTemplateId}`}>Zentrale Druckvorlage öffnen</Link><p className="text-xs">Farben, Schriften und Logos stammen aus der zentralen Vorlage; das Papierformat gehört zu diesem Event. Vorhandene Karten behalten ihren eingefrorenen Druckstand.</p></>:<PrintFields value={own?value:data.inherited} onChange={change} disabled={!ready||!data.canWrite||pending||!own} templateLogo={data.logo}/>}
    <div className="flex flex-wrap gap-3">{data.canWrite&&<><Button disabled={!ready||pending||!valid} type="submit">Druckeinstellungen speichern</Button><Button type="button" disabled={!ready||pending} onClick={()=>{setOwn(false);setPreview(null);setMessage('Vererbter Standard ausgewählt. Bitte ausdrücklich speichern.');}}>Vererbten Standard wiederherstellen</Button><Button type="button" disabled={!ready||pending||!valid} onClick={()=>start(async()=>{const r=await getBingoPrintPreview({target:data.target,config:own?selectedConfig:null});if(r.success){setPreview(r);setMessage('Vorschau aktualisiert; Einstellungen noch nicht automatisch gespeichert.');}else setMessage(r.message);})}>Druckvorschau aktualisieren</Button></>}<Link href={returnHref} className="inline-flex min-h-11 items-center underline">Abbrechen</Link></div>
    {!data.canWrite&&<p>Nur Lesezugriff. Änderungen benötigen Verwaltungsrecht und eine aktive Eventreihe.</p>}{message&&<p role="status">{message}</p>}
  </form><PrintPreview preview={preview}/></div>;
}
