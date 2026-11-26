'use client';
import Link from 'next/link';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Input,Select} from '@/components/ui';
import {saveContent} from './actions';
import type {readRoundContent} from './repository.server';
import {termFor} from '../preparation/termSet';
import {useContentNavigationGuard} from '@/app/components/content/useContentNavigationGuard';

export default function ContentLibrary({data}:{data:Awaited<ReturnType<typeof readRoundContent>>}) {
  const router=useRouter(),[pending,start]=useTransition();
  const [name,setName]=useState(''),[series,setSeries]=useState(String(data.choices.find(c=>c.canCreate)?.id??'')),[target,setTarget]=useState('30'),[text,setText]=useState(''),[mode,setMode]=useState('NUMBER'),[message,setMessage]=useState(''),[editing,setEditing]=useState<string|null>(null);
  const [sourceGameId,setSourceGameId]=useState('');
  const template=data.templates.find(t=>t.id===editing);
  const markSaved=useContentNavigationGuard(Boolean(name||text));
  return <div className="space-y-6"><p>Rundenvorlagen sind Content der Eventreihe. Beim Übernehmen in einen Bingo-Abend entsteht eine unabhängige Kopie. Änderungen hier ändern keine bestehenden Runden oder Karten.</p>
    <form className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();start(async()=>{
      const entries=text.split(/\r?\n/).map((value,i)=>({number:i+1,text:value.trim()}));
      const config=mode==='NUMBER'?null:{version:1,name,publication:'DIRECT',entries};
      const result=await saveContent({id:editing??undefined,seriesId:Number(series),revision:template?.revision,name,target:Number(target),config,...(!editing&&sourceGameId?{sourceGameId}:{})});
      if(!result.success){setMessage(result.message);return;}markSaved();setName('');setText('');setEditing(null);setMessage('Rundenvorlage gespeichert. Bestehende Abende bleiben unverändert.');router.refresh();
    });}}>
      <h2 className="sm:col-span-2">{editing?'Rundenvorlage bearbeiten':'Neue Rundenvorlage'}</h2>
      <label>Eventreihe<Select required disabled={pending||Boolean(editing)} value={series} onChange={e=>setSeries(e.target.value)}>{data.choices.filter(c=>c.canCreate).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>
      {!editing&&<label>Optionaler Quellenkontext für Musik/Medien<Select value={sourceGameId} onChange={e=>setSourceGameId(e.target.value)}><option value="">Ohne Medien · Standard/Text</option>{data.games.filter(g=>String(g.eventreihe_id)===series).map(g=><option key={g.id} value={g.id}>{g.titel}</option>)}</Select><small>Verwendet bestehende Quellrechte und Medienablage, ändert keine Runde dieses Abends.</small></label>}
      <label>Name<Input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Geplante Ziehungen<Input type="number" min={1} max={75} required value={target} onChange={e=>setTarget(e.target.value)}/></label>
      <label>Kartenart<Select value={mode} onChange={e=>setMode(e.target.value)}><option value="NUMBER">Standard · 75 Zahlen</option><option value="TEXT">Spezial · 75 Textzuordnungen</option></Select></label>
      {mode==='TEXT'&&<label className="sm:col-span-2">Matching-Tabelle: eine Zeile je Kugel, genau 75 Zeilen<textarea className="block min-h-64 w-full rounded border p-3 font-mono" required value={text} onChange={e=>setText(e.target.value)}/><span>Benötigt eigene Spezialkarten. Bestehende Druckgrenzen gelten.</span></label>}
      <div className="flex gap-3"><Button disabled={pending||!series}>Speichern</Button><Button type="button" variant="secondary" onClick={()=>{setName('');setText('');setEditing(null);}}>Abbrechen</Button></div>
      {message&&<p role="status">{message}</p>}
    </form>
    <p>Musik und andere Medien können im Matching-Editor der Content-Vorlage bearbeitet werden. Alternativ im vorhandenen Matching-Editor einer vorbereiteten Runde auswählen und speichern. „Als Rundenvorlage in Content übernehmen“ bewahrt eine eigene Zuordnungsfassung mit den gespeicherten Medien. Neue Fassungen ersetzen bestehende Vorlagen und Abendkopien nicht.</p>
    <section aria-label="Rundenvorlagen" className="grid gap-4 md:grid-cols-2">{data.templates.map(t=><article key={t.id} className="space-y-3 rounded-xl border p-4"><h2>{t.name}</h2><p>{data.choices.find(c=>c.id===t.eventreihe_id)?.name} · {t.planned_draws} Ziehungen · {t.config?'Spezialkarten erforderlich':'Standardkarten'}</p><p className="text-sm">{new Date(t.createdAt).toLocaleString('de-DE')} · Fassung {t.revision+1}</p>
      {t.config&&<details><summary className="min-h-11 cursor-pointer">Matching-Tabelle anzeigen</summary><ol>{Array.from({length:75},(_,i)=><li key={i}>{i+1}: {termFor(t.config!,i+1)}{t.config?.version===2&&t.config.entries[i].presentation.kind==='MEDIA'?' · gespeichertes Medium':''}</li>)}</ol></details>}
      {t.source_game_id&&<Link className="inline-flex min-h-11 items-center underline" href={`/bingo/content/${t.id}`}>Matching-Tabelle bearbeiten · nur Content</Link>}
      {t.config?.version!==2&&!data.choices.find(c=>c.id===t.eventreihe_id)?.isArchived&&<Button variant="secondary" onClick={()=>{if((name||text)&&!window.confirm('Ungespeicherte Eingaben verwerfen?'))return;setEditing(t.id);setName(t.name);setSeries(String(t.eventreihe_id));setTarget(String(t.planned_draws));setMode(t.config?'TEXT':'NUMBER');setText(t.config?.version===1?t.config.entries.map(e=>e.text).join('\n'):'');}}>Bearbeiten</Button>}
    </article>)}</section>
  </div>;
}
