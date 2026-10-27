"use client";
import { useEffect,useRef,useState } from "react";
export type PreviewResult={hash:string;front:string;back:string};
export default function PrintPreview({preview}:{preview:PreviewResult|null}){
  const [side,setSide]=useState<'front'|'back'>('front'),frame=useRef<HTMLIFrameElement>(null),link=useRef<HTMLAnchorElement>(null);
  useEffect(()=>{if(!preview)return;const url=(v:string)=>URL.createObjectURL(new Blob([Uint8Array.from(atob(v),c=>c.charCodeAt(0))],{type:'application/pdf'}));const next=url(preview[side]);if(frame.current)frame.current.src=next;if(link.current)link.current.href=next;return()=>URL.revokeObjectURL(next);},[preview,side]);
  if(!preview)return <p className="text-sm">„Druckvorschau aktualisieren“ zeigt die tatsächliche PDF-Zeichnung mit Originalschriften und Logos.</p>;
  return <section aria-label="Tatsächliche Druckvorschau" className="space-y-3"><div className="flex flex-wrap gap-3">{(['front','back'] as const).map(v=><button key={v} type="button" aria-pressed={side===v} className="min-h-11 rounded-lg border px-4" onClick={()=>setSide(v)}>{v==='front'?'Vorderseite':'Rückseite'}</button>)}<a ref={link} className="inline-flex min-h-11 items-center underline" target="_blank" rel="noreferrer">Vorschau-PDF öffnen</a></div><iframe ref={frame} title={side==='front'?'Vorderseite · tatsächliches PDF':'Rückseite · tatsächliches PDF'} className="h-[640px] w-full rounded border bg-slate-100"/><p className="text-xs">Einzelkarten-Vorschau mit derselben PDF-Zeichnung wie im Export. Bei blockierter PDF-Einbettung „Vorschau-PDF öffnen“ verwenden.</p></section>;
}
