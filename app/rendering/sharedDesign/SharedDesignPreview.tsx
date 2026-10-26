"use client";
import { PHIL_GUD } from "@/app/branding/philGud";
import { PresentationTemplatePreview } from "../presentationTemplates/PresentationTemplatePreview";
import type { PresentationTemplateConfig } from "../presentationTemplates/presentationTemplate";
import type { SharedDesign } from "./sharedDesign";
import { BingoDisplayRenderer, KaraokeSlideRenderer } from "./FormatDisplays";
export default function SharedDesignPreview({design,format,legacyConfig}:{design:SharedDesign;format:string;legacyConfig?:PresentationTemplateConfig|null}){
 const quiz= format==='SERIES'||format==='QUIZ',bingo=format==='SERIES'||format==='BINGO',karaoke=format==='SERIES'||format==='POWERPOINT_KARAOKE';
 const config=legacyConfig??design.config;
 return <div className="space-y-8" data-design-preview="true">
 {quiz&&<section aria-label="Quiz-Designvorschau"><h2>Quiz · Frage und Auflösung</h2><div className="mt-4 grid gap-5 xl:grid-cols-2">{(['MULTIPLE_CHOICE','SOLUTION'] as const).map(s=><PresentationTemplatePreview responsive key={s} config={config} templateId={design.templateId} templateName={design.name} scenario={s}/>)}</div></section>}
 {bingo&&<section aria-label="Bingo-Designvorschau"><h2>Bingo</h2><div className="mt-4 grid gap-5 xl:grid-cols-2"><BingoDisplayRenderer design={design} data={{current:'42',previous:['7','18','23','36'],kind:'NUMBER'}}/><BingoDisplayRenderer design={design} data={{current:'Das müssen wir größer denken!',previous:['Synergien nutzen','Kurze Rückfrage'],kind:'PHRASE'}}/></div></section>}
 {karaoke&&<section aria-label="Karaoke-Designvorschau"><h2>PowerPoint-Karaoke</h2><div className="mt-4 grid gap-5 xl:grid-cols-2"><KaraokeSlideRenderer design={design} data={{title:'Große Ideen für übermorgen'}}/><KaraokeSlideRenderer design={design} data={{title:'Überraschend überzeugend',body:'Grüße aus der Zukunft: Äpfel, Öl und süße Grüße.\n2026 Gründe für einen mutigen Perspektivwechsel.',image:PHIL_GUD.gudi,imageAlt:'Synthetisches Folienbeispiel: Gudi'}}/></div></section>}
 </div>;
}
