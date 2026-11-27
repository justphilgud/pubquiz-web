import Link from 'next/link';
import {EventPreparationBlock} from '@/app/events/EventPreparationBlock';
import {CEREMONY_SLIDES,outroConfig,type CeremonyState} from '@/app/rendering/ceremony/ceremony';

export default function CeremonySummary({gameId,state,placement='intro'}:{gameId:string;state:CeremonyState;placement?:'intro'|'outro'}){
 const title=placement==='intro'?'Intro':'Outro',config=placement==='outro'?outroConfig(state.config):state.config;
 const slides=CEREMONY_SLIDES.filter(s=>s.phase===(placement==='intro'?'INTRO':'OUTRO'));
 return <EventPreparationBlock title={title} marker={placement==='intro'?'IN':'OUT'} tone={placement} description={`${slides.filter(s=>config.enabled.includes(s.id)).length} aktive Slides · Fixiert`}>
  <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="font-bold text-slate-900">{title} konfigurieren</div><p className="mt-1 text-sm text-slate-500">{placement==='intro'?'Vor allen Bingo-Runden':'Nach der letzten Bingo-Runde'}</p></div><Link className="inline-flex min-h-11 items-center justify-center self-start rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50" href={`/bingo/${gameId}/slides/${placement}`}>{title} konfigurieren</Link></article>
 </EventPreparationBlock>;
}
