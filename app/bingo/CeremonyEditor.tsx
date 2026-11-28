'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {EventSlideEditor} from '@/app/events/EventSlideEditor';
import {outroConfig,defaultCeremony,CEREMONY_SLIDES,type CeremonyState,type CeremonyConfig} from '@/app/rendering/ceremony/ceremony';
import {saveCeremony} from './ceremonyActions';
import {useContentNavigationGuard} from '@/app/components/content/useContentNavigationGuard';
const insertionConfig=(value:CeremonyState,placement?:string)=>placement==='outro'?outroConfig(value.config):placement?value.config.insertions?.[placement]??defaultCeremony().config:value.config;
export default function CeremonyEditor({gameId,initial,placement,onSaved,label="Intro vor der ersten Runde",readOnly=false}:{gameId:string;initial:CeremonyState;placement?:string;label?:string;readOnly?:boolean;onSaved?:(state:CeremonyState)=>void}){
  const ownConfig=(value:CeremonyState)=>insertionConfig(value,placement);
  const [selected,setSelected]=useState(placement==='outro'?'announcements':'waiting'),[received,setReceived]=useState(initial);
  const [state,setState]=useState(initial),[config,setConfig]=useState(ownConfig(initial)),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const slides=CEREMONY_SLIDES.filter(s=>s.phase===(placement==='outro'?'OUTRO':'INTRO'));
  const dirty=JSON.stringify(config)!==JSON.stringify(ownConfig(state));
  const markSaved=useContentNavigationGuard(dirty),router=useRouter();
  const cancel=()=>{if(busy||dirty&&!window.confirm('Ungespeicherte Änderungen verwerfen?'))return;markSaved();router.push(`/bingo/${gameId}`);};
  if(received!==initial){setReceived(initial);if(!dirty){setState(initial);setConfig(insertionConfig(initial,placement));}}
  const update=(patch:Partial<CeremonyConfig>)=>setConfig(c=>({...c,...patch}));
  const startsAt=config.startsAt?new Date(Date.parse(config.startsAt)-new Date(config.startsAt).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  return <EventSlideEditor eyebrow="Bingo · Folien" backLabel="Zurück zur Bingo-Vorbereitung" title={label} selected={selected} onSelect={setSelected} onCancel={cancel} items={slides.map(s=>({...s,enabled:config.enabled.includes(s.id)}))}><h2 className="mb-5 text-2xl font-black">{slides.find(s=>s.id===selected)?.label}</h2><form className="grid gap-4" onSubmit={async e=>{e.preventDefault();if(busy||readOnly||!dirty)return;setBusy(true);try{const result=await saveCeremony(gameId,state.revision,{kind:'configure',config:placement==='outro'?{...state.config,outro:config}:placement?{...state.config,insertions:{...state.config.insertions,[placement]:config}}:config});if(result.success){markSaved();setState(result.state);setConfig(ownConfig(result.state));onSaved?.(result.state);router.push(`/bingo/${gameId}`);}else setMessage(result.message);}catch{setMessage('Nicht gespeichert. Deine Eingaben bleiben erhalten. Bitte erneut versuchen.');}finally{setBusy(false);}}}><fieldset disabled={busy||readOnly} className="grid min-w-0 gap-4">
    {readOnly&&<p role="status">Archivierte Eventreihe: nur Lesen.</p>}
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={config.enabled.includes(selected as typeof slides[number]['id'])} onChange={e=>update({enabled:e.target.checked?[...config.enabled,selected as typeof slides[number]['id']]:config.enabled.filter(id=>id!==selected)})}/>Slide aktivieren</label>
    <label hidden={selected!=='countdown'}>Startzeit (lokale Zeit)<input className="block w-full rounded border p-2" type="datetime-local" value={startsAt} onChange={e=>update({startsAt:e.target.value?new Date(e.target.value).toISOString():''})}/></label>
    {(['introVideoUrl','introMusicUrl','outroMusicUrl'] as const).map(key=><label hidden={selected!==({introVideoUrl:'waiting',introMusicUrl:'countdown',outroMusicUrl:'announcements'}[key])} key={key}>{{introVideoUrl:'Wartevideo (optional)',introMusicUrl:'Intro-Musik (optional)',outroMusicUrl:'Outro-Musik (optional)'}[key]}<input className="block w-full rounded border p-2" type="text" value={config[key]??''} maxLength={2000} placeholder="/medien/… oder https://…" onChange={e=>update({[key]:e.target.value})}/></label>)}
    {(['waiting','welcome','rules','announcements','mainPrize'] as const).map(key=><label hidden={selected!==({waiting:'waiting',welcome:'welcome',rules:'rules',announcements:'announcements',mainPrize:'raffle'}[key])} key={key}>{{waiting:'Wartetext',welcome:'Begrüßung',rules:'Regeln',announcements:'Bekanntmachungen',mainPrize:'Hauptpreis der Abschlussverlosung'}[key]}<textarea className="block w-full rounded border p-2" value={config[key]} maxLength={4000} onChange={e=>update({[key]:e.target.value})}/></label>)}
    <label hidden={selected!=='prizes'}>Preise – eine Platzierung pro Zeile, Platz 1 zuerst<textarea className="block w-full rounded border p-2" rows={4} value={config.prizes.join('\n')} onChange={e=>update({prizes:e.target.value.split('\n')})}/></label>
    {selected==='prizes'&&<p>Preise werden von der letzten belegten Platzierung bis Platz 1 aufgedeckt. Die Moderation steuert jede Enthüllung.</p>}</fieldset><div className="flex gap-3"><button className="min-h-11 rounded-xl bg-slate-900 px-5 py-2.5 font-bold text-white" disabled={busy||readOnly||!dirty}>{busy?'Wird gespeichert …':'Slide speichern'}</button><button className="min-h-11 rounded-xl border border-slate-300 px-4" type="button" disabled={busy} onClick={cancel}>Abbrechen</button></div>{message&&<p role="alert">{message}</p>}
  </form></EventSlideEditor>;
}
