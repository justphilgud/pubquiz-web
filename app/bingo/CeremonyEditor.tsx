'use client';
import {useState} from 'react';
import {CEREMONY_SLIDES,type CeremonyState,type CeremonyConfig} from '@/app/rendering/ceremony/ceremony';
import {saveCeremony} from './ceremonyActions';
import {useContentNavigationGuard} from '@/app/components/content/useContentNavigationGuard';
export default function CeremonyEditor({gameId,initial}:{gameId:string;initial:CeremonyState}){
  const [state,setState]=useState(initial),[config,setConfig]=useState(initial.config),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const dirty=JSON.stringify(config)!==JSON.stringify(state.config);
  useContentNavigationGuard(dirty);
  const update=(patch:Partial<CeremonyConfig>)=>setConfig(c=>({...c,...patch}));
  const startsAt=config.startsAt?new Date(Date.parse(config.startsAt)-new Date(config.startsAt).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  return <details className="rounded-xl border border-slate-300 bg-white p-4"><summary className="min-h-11 cursor-pointer font-bold">Intro, Outro und Abschlussverlosung konfigurieren</summary><form className="grid gap-4" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);try{const result=await saveCeremony(gameId,state.revision,{kind:'configure',config});if(result.success){setState(result.state);setConfig(result.state.config);setMessage('Gespeichert.');}else setMessage(result.message);}finally{setBusy(false);}}}>
    <fieldset disabled={busy} className="grid grid-cols-2 gap-2"><legend>Aktive Folien</legend>{CEREMONY_SLIDES.map(s=><label key={s.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={config.enabled.includes(s.id)} onChange={e=>update({enabled:e.target.checked?[...config.enabled,s.id]:config.enabled.filter(id=>id!==s.id)})}/>{s.label}</label>)}</fieldset>
    <label>Startzeit (lokale Zeit)<input className="block w-full rounded border p-2" type="datetime-local" value={startsAt} onChange={e=>update({startsAt:e.target.value?new Date(e.target.value).toISOString():''})}/></label>
    {(['introVideoUrl','introMusicUrl','outroMusicUrl'] as const).map(key=><label key={key}>{{introVideoUrl:'Wartevideo (optional)',introMusicUrl:'Intro-Musik (optional)',outroMusicUrl:'Outro-Musik (optional)'}[key]}<input className="block w-full rounded border p-2" type="text" value={config[key]??''} maxLength={2000} placeholder="/medien/… oder https://…" onChange={e=>update({[key]:e.target.value})}/></label>)}
    {(['waiting','welcome','rules','announcements','mainPrize'] as const).map(key=><label key={key}>{{waiting:'Wartetext',welcome:'Begrüßung',rules:'Regeln',announcements:'Bekanntmachungen',mainPrize:'Hauptpreis der Abschlussverlosung'}[key]}<textarea className="block w-full rounded border p-2" value={config[key]} maxLength={4000} onChange={e=>update({[key]:e.target.value})}/></label>)}
    <label>Preise – eine Platzierung pro Zeile, Platz 1 zuerst<textarea className="block w-full rounded border p-2" rows={4} value={config.prizes.join('\n')} onChange={e=>update({prizes:e.target.value.split('\n')})}/></label>
    <p>Preise werden von der letzten belegten Platzierung bis Platz 1 aufgedeckt. Die Moderation steuert jede Enthüllung.</p><div className="flex gap-3"><button className="min-h-11 rounded border px-4" disabled={busy||!dirty}>Speichern</button><button className="min-h-11 rounded border px-4" type="button" disabled={busy} onClick={()=>setConfig(state.config)}>Abbrechen</button></div>{message&&<p role="status">{message}</p>}
  </form></details>;
}
