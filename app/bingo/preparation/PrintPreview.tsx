"use client";
import PdfPreviewCanvas from "./PdfPreviewCanvas";
import { useEffect,useRef,useState } from "react";
export type PreviewResult={hash:string;front:string;back?:string;sheet?:string};
export default function PrintPreview({preview}:{preview:PreviewResult|null}){
  const [side,setSide]=useState<'front'|'back'|'sheet'>('front'),link=useRef<HTMLAnchorElement>(null);
  useEffect(()=>{if(!preview)return;const url=(v:string)=>URL.createObjectURL(new Blob([Uint8Array.from(atob(v),c=>c.charCodeAt(0))],{type:'application/pdf'}));const next=url(preview[side]??preview.front);if(link.current)link.current.href=next;return()=>URL.revokeObjectURL(next);},[preview,side]);
  if(!preview)return <p className="text-sm">„Druckvorschau aktualisieren“ zeigt die tatsächliche PDF-Zeichnung mit Originalschriften und Logos.</p>;
  return <section aria-label="Tatsächliche Druckvorschau" className="space-y-3"><div className="flex flex-wrap gap-3">{(['front',...(preview.back?['back' as const]:[]),...(preview.sheet?['sheet' as const]:[])] as const).map(v=><button key={v} type="button" aria-pressed={side===v} className="min-h-11 rounded-lg border px-4" onClick={()=>setSide(v)}>{v==='front'?'Vorderseite':v==='back'?'Rückseite':'Vollständiger Druckbogen'}</button>)}<a ref={link} className="inline-flex min-h-11 items-center underline" target="_blank" rel="noreferrer">Vorschau-PDF öffnen</a></div><PdfPreviewCanvas key={preview.hash+side} base64={preview[side]??preview.front} label={side==='front'?'Vorderseite · tatsächliches PDF':side==='back'?'Rückseite · tatsächliches PDF':'Druckbogen · Vorder- und Rückseiten'}/><p className="text-xs">Einzelkarte direkt über „Vergrößerung“ prüfen. Vorderseite, zugehörige Rückseite und Druckbogen stammen aus demselben Renderer. Die Vorschau zeichnet genau das erzeugte PDF. „Vorschau-PDF öffnen“ bleibt als zusätzlicher Download verfügbar.</p></section>;
}
