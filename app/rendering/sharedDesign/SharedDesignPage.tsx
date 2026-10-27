import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { requireActor } from "@/app/lib/permissions";
import { DesignError, readDesign, type DesignTarget } from "./sharedDesignRepository.server";
import SharedDesignSelection from "./SharedDesignSelection";
import SharedDesignPreview from "./SharedDesignPreview";
export default async function SharedDesignPage({target}:{target:DesignTarget}){
 const {actor}=await requireActor();
 const data=await readDesign(actor.userId,target).catch(e=>{if(e instanceof DesignError)notFound();throw e;});
 const href=target.kind==='SERIES'?`/admin/eventreihen/${target.id}`:target.kind==='QUIZ'?`/quiz/${target.id}`:`/${target.kind==='BINGO'?'bingo':'karaoke'}/${target.id}`;
 return <>{target.kind!=='SERIES'&&<AppHeader/>}<main className="mx-auto max-w-[1600px] space-y-6 px-4 py-8"><Link href={href} className="underline">Zurück zum Objekt</Link><h1>Gemeinsames Design · {data.seriesName}</h1><p>Designvorschau · synthetische Beispieldaten · kein Spielbetrieb</p><SharedDesignSelection target={target} initial={data.selection} seriesId={data.seriesId} templates={data.templates} canWrite={data.canWrite} returnHref={href} answerSelection={data.answerSelection} answerTemplates={data.answerTemplates}/><p role="status">{target.kind==='QUIZ'&&data.selection===null?'Bisherige Quizvorlagen – gemeinsames Design nicht aktiviert':`${data.source}: ${data.design.name}`}</p><p className="text-sm">Reihenlogo vor Vorlagenlogo; Farben und Schriften aus der Vorlage. Vertrag V1 · Frage/Auflösung, Bingo-Zahl/Phrase, Karaoke-Titel/Inhalt.</p><SharedDesignPreview design={data.design} format={target.kind} legacyConfig={data.legacyConfig}/></main></>;
}
