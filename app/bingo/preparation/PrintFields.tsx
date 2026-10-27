"use client";
import localFont from "next/font/local";
import { PHIL_LOGO, LOVD_LOGO, printFonts, printContrastIssues, parseBingoPrint, type BingoPrint } from "@/app/bingo/preparation/bingoPrint";
const phil=localFont({src:'../../../public/branding/phil-gud/phil-gud.woff',weight:'400'});
const montserrat=localFont({src:'../../../assets/fonts/bingo/montserrat.ttf',weight:'400'});
const arimo=localFont({src:'../../../assets/fonts/arimo/Arimo.ttf',weight:'400'});
const faces={PHIL_GUD:phil.className,MONTSERRAT:montserrat.className,ARIMO:arimo.className};
const labels={background:'Kartenhintergrund',header:'BINGO-Kopfbereich',grid:'Rasterlinien',heading:'BINGO-Schriftfarbe',numbers:'Zahlenfarbe',back:'Rückseitenhintergrund'};
export default function PrintFields({value,onChange,disabled=false,templateLogo}:{value:BingoPrint;onChange:(v:BingoPrint)=>void;disabled?:boolean;templateLogo?:string|null}){
  const logos=[{value:PHIL_LOGO,label:'Phil Gud · Original'},{value:LOVD_LOGO,label:'LOVD · Original'}];
  for(const ref of [templateLogo,value.frontLogo,...value.backLogos])if(ref&&!logos.some(l=>l.value===ref))logos.push({value:ref,label:ref===templateLogo?'Aktuelles Reihen-/Vorlagenlogo':`Gespeichertes Drucklogo ${logos.length-1}`});
  const selectLogo=(label:string,current:string,change:(v:string)=>void)=><label className="block text-sm">{label}<select aria-label={label} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3" value={current} onChange={e=>change(e.target.value)}>{logos.map(l=><option key={l.value} value={l.value}>{l.label}</option>)}</select></label>;
  return <fieldset disabled={disabled} className="min-w-0 space-y-4"><legend className="sr-only">Bingo-Druckgestaltung</legend><div className="grid gap-3 sm:grid-cols-2">
    {selectLogo('Logo im vorderen Freifeld',value.frontLogo,frontLogo=>onChange({...value,frontLogo}))}
    <label className="block text-sm">Rückseitenlogos<select aria-label="Rückseitenlogos" className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3" value={value.backLogos.length} onChange={e=>onChange({...value,backLogos:e.target.value==='1'?[value.backLogos[0]]:[value.backLogos[0],value.backLogos[0]===PHIL_LOGO?LOVD_LOGO:PHIL_LOGO]})}><option value={1}>Ein Logo</option><option value={2}>Zwei Logos</option></select></label>
    {value.backLogos.map((logo,i)=><div key={i}>{selectLogo(`Rückseitenlogo ${i+1}`,logo,ref=>onChange({...value,backLogos:value.backLogos.map((v,j)=>j===i?ref:v)}))}</div>)}
  </div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(labels).map(([key,label])=><label key={key} className="block text-sm">{label}<div className="mt-1 flex gap-2"><input aria-label={`${label} auswählen`} type="color" value={value.colors[key as keyof typeof labels]} onChange={e=>onChange({...value,colors:{...value.colors,[key]:e.target.value}})} className="h-11 w-12 shrink-0 rounded border"/><input aria-label={label} value={value.colors[key as keyof typeof labels]} maxLength={7} onChange={e=>onChange({...value,colors:{...value.colors,[key]:e.target.value}})} className="min-h-11 min-w-0 w-full rounded border px-2"/></div></label>)}</div>
    <div className="grid gap-4 sm:grid-cols-2">{(['headerFont','numberFont'] as const).map(key=><label key={key} className="block text-sm">{key==='headerFont'?'BINGO-Schriftzug':'Zahlen'}<select aria-label={key==='headerFont'?'BINGO-Schriftzug':'Zahlen'} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3" value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})}>{printFonts.filter(f=>key==='headerFont'||f.id!=='PHIL_GUD').map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><span data-font-sample={key} className={`mt-2 block rounded border bg-white p-3 text-2xl text-slate-950 ${faces[value[key]]}`}>{key==='headerFont'?'BINGO':'1 · 7 · 16 · 36 · 51 · 75'}</span></label>)}</div>
    {!parseBingoPrint(value)&&<p role="alert" className="text-sm text-red-800">Bitte gültige sechsstellige Farben und ein oder zwei unterschiedliche Rückseitenlogos wählen.</p>}{printContrastIssues(value).map(issue=><p key={issue} role="alert" className="text-sm text-red-800">{issue}</p>)}
    <p className="text-xs text-slate-600">Nur Druckkarten. Website, Verwaltung und Livevorlagen behalten ihre eigenen Logos, Farben und Schriften.</p>
  </fieldset>;
}
