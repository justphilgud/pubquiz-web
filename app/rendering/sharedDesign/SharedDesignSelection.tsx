"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Select } from "@/components/ui";
import { useContentNavigationGuard } from "@/app/components/content/useContentNavigationGuard";
import { saveSharedDesign } from "./actions";
import type { DesignTarget } from "./sharedDesignRepository.server";
export default function SharedDesignSelection({target,initial,seriesId,templates,canWrite,returnHref,answerSelection,answerTemplates}:{target:DesignTarget;initial:string|null;seriesId:number;templates:{id:string;name:string}[];canWrite:boolean;returnHref:string;answerSelection:string|null;answerTemplates:{id:string;name:string}[]}){
 const router=useRouter(),[value,setValue]=useState(initial??''),[baseline,setBaseline]=useState(initial??''),[message,setMessage]=useState(''),[pending,start]=useTransition();
 const [answer,setAnswer]=useState(answerSelection??''),[answerBaseline,setAnswerBaseline]=useState(answerSelection??'');
 const markSaved=useContentNavigationGuard(value!==baseline||answer!==answerBaseline);
 return <form className="space-y-3 rounded-xl border bg-white p-4" onSubmit={e=>{e.preventDefault();start(async()=>{try{const r=await saveSharedDesign({target,selection:value||null,expectedSelection:baseline||null,expectedSeriesId:seriesId,...(target.kind==='QUIZ'?{answerSelection:answer||null,expectedAnswerSelection:answerBaseline||null}:{})});if(!r.success){setMessage(r.message);return;}setBaseline(value);setAnswerBaseline(answer);markSaved();setMessage('Design gespeichert. Die Vorschau zeigt den gespeicherten Stand.');router.refresh();}catch{setMessage('Design konnte nicht gespeichert werden.');}});}}>
 <label className="block">Gemeinsame Designvorlage<Select value={value} disabled={!canWrite||pending} onChange={e=>setValue(e.target.value)}><option value="">{target.kind==='QUIZ'?'Bisherige Quizvorlagen beibehalten':target.kind==='SERIES'?'Systemstandard verwenden (Phil Gud)':'Reihenstandard verwenden'}</option>{target.kind==='QUIZ'&&<option value="INHERIT">Reihenstandard verwenden</option>}{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select></label>
 {target.kind==='QUIZ'&&<label className="block">Antwortformularvorlage (getrennt)<Select value={answer} disabled={!canWrite||pending||!value} onChange={e=>setAnswer(e.target.value)}><option value="">Antwortformularstandard der Reihe verwenden</option>{answerTemplates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select></label>}
 <p className="text-sm text-slate-600">Vorschauen verwenden den gespeicherten Stand. Änderungen wirken nach erneutem Öffnen; laufende Quizze behalten ihr beim Start eingefrorenes Design.</p>
 {!canWrite&&<p>Nur Lesezugriff. Änderungen sind nur mit Verwaltungsrecht und vor dem Quizstart möglich.</p>}
 {message&&<p role="status">{message}</p>}
 <div className="flex flex-wrap gap-3">{canWrite&&<Button type="submit" disabled={pending}>{pending?'Wird gespeichert …':'Design speichern'}</Button>}<Link href={returnHref} className="inline-flex min-h-11 items-center underline">{canWrite?'Abbrechen':'Zurück'}</Link></div>
 </form>;
}
