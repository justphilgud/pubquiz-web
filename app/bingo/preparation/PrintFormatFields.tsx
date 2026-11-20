"use client";
import {cardProfiles, changePrintFormat, geometry, printFormats, type CardProfile, type PrintFormat, type PrintLayout} from './printFormats';

/** One shared paper/profile selection for generation, settings and redesign previews. */
export default function PrintFormatFields({value,onChange,disabled=false}:{value:PrintLayout;onChange:(value:PrintLayout)=>void;disabled?:boolean}) {
  return <fieldset disabled={disabled} className="min-w-0 space-y-3">
    <label className="block text-sm">Papierformat und Kartenaufteilung<select aria-label="Papierformat und Kartenaufteilung" className="mt-1 min-h-11 w-full rounded border bg-white px-3" value={value.format} onChange={e=>onChange(changePrintFormat(value,e.target.value as PrintFormat))}>{Object.entries(printFormats).map(([id,f])=><option key={id} value={id}>{f.label}</option>)}</select></label>
    {value.format==='SRA3_TWELVE'&&<label className="block text-sm">Kartengröße<select aria-label="Kartengröße" className="mt-1 min-h-11 w-full rounded border bg-white px-3" value={value.cardProfile??'A4_FOUR'} onChange={e=>onChange({...value,cardProfile:e.target.value as CardProfile})}>{cardProfiles.map(id=><option key={id} value={id}>{printFormats[id].label} · {geometry(id).sideMm.toLocaleString('de-DE')} mm</option>)}</select></label>}
    <p className="text-xs">Wirksame Kartenkante: {geometry(value.format,value.cardProfile).sideMm.toLocaleString('de-DE')} mm. {value.format==='SRA3_TWELVE'?'SRA3 · 3 × 4 Karten · 5 mm Schnittabstand. ':''}Tatsächliche Größe / 100 % · an der langen Kante wenden.</p>
  </fieldset>;
}
