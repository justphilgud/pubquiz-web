'use client';
import Link from 'next/link';
import {useState,useTransition,type SetStateAction} from 'react';
import {useRouter} from 'next/navigation';
import {MagnifyingGlassIcon,CheckIcon,ArrowDownTrayIcon} from '@heroicons/react/24/outline';
import {Button,Input,Select,IconButton} from '@/components/ui';
import {useContentNavigationGuard} from '@/app/components/content/useContentNavigationGuard';
import {matchingVariantLabel,initialMatchingEntries,matchingErrors,printedMatchingText,type MatchingEntry,type SourceAnswer} from '../preparation/matching';
import type {readMatchingEditor} from './repository.server';
import {getMatchingSource,saveMatching} from './actions';
import SourcePicker,{MatchingPreview} from './SourcePicker';
import styles from './MatchingEditor.module.css';
type Data=Awaited<ReturnType<typeof readMatchingEditor>>;

export default function MatchingEditor({data}:{data:Data}){
 const router=useRouter(),initial={name:data.current?.name??'Zuordnung 1',publication:data.current?.publication??'DIRECT',entries:initialMatchingEntries(data.current)};
 const [draft,setDraftState]=useState(initial),[baseline,setBaseline]=useState(JSON.stringify(initial)),[from,setFrom]=useState('1'),[to,setTo]=useState('75'),[selected,setSelected]=useState<Set<number>>(new Set()),[sourceNumber,setSourceNumber]=useState<number|null>(null),[answers,setAnswers]=useState<Record<number,SourceAnswer[]>>({}),[message,setMessage]=useState(''),[pending,start]=useTransition();
 const dirty=JSON.stringify(draft)!==baseline,markSaved=useContentNavigationGuard(dirty),errors=matchingErrors(draft.entries),blocked=data.locked||pending;
 function setDraft(next:SetStateAction<typeof initial>){setMessage('');setDraftState(next);}
 function update(n:number,change:Partial<MatchingEntry>){setDraft(d=>({...d,entries:d.entries.map(e=>e.number===n?{...e,...change}:e)}));}
 async function loadAnswers(entry:MatchingEntry){if(entry.presentation.kind!=='MEDIA'||!entry.presentation.source||answers[entry.number])return;const q=await getMatchingSource(data.gameId,entry.presentation.source.questionId,entry.presentation.source.assetId);if(q.success)setAnswers(a=>({...a,[entry.number]:q.item.answers}));}
 const validRange=/^\d+$/.test(from)&&/^\d+$/.test(to)&&Number(from)>=1&&Number(to)<=90&&Number(from)<=Number(to),visible=validRange?draft.entries.filter(e=>e.number>=Number(from)&&e.number<=Number(to)):[];
 const changedCount=draft.entries.filter(e=>e.number<=75&&!e.keepNumber).length;
 return <div className={styles.editor}>
  <form onSubmit={e=>{e.preventDefault();start(async()=>{const result=await saveMatching({gameId:data.gameId,roundId:data.roundId,revision:data.revision,config:{version:2,...draft}});if(!result.success){setMessage(result.message);return;}markSaved();setBaseline(JSON.stringify(draft));setMessage('Neue Zuordnungsfassung gespeichert.');router.refresh();});}}>
   <section className={styles.settings} aria-labelledby="matching-settings-title">
    <div className={styles.sectionTitle}><h2 id="matching-settings-title">Deine Zuordnung</h2><span>{data.label} · 75er-Bingo</span></div>
    <fieldset disabled={blocked} className={styles.settingsGrid}>
     <label>Zuordnungssatz<Input required maxLength={80} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
     <label>Gespeicherte Fassung übernehmen<Select defaultValue="" onChange={e=>{const set=data.sets.find(s=>s.id===e.target.value);if(set)setDraft({name:set.config.name,publication:set.config.publication,entries:initialMatchingEntries(set.config)});}}><option value="">Fassung auswählen …</option>{data.sets.map(s=><option key={s.id} value={s.id}>{s.config.name} · {new Date(s.createdAt).toLocaleString('de-DE')}</option>)}</Select></label>
     <label>Veröffentlichung<Select value={draft.publication} onChange={e=>setDraft({...draft,publication:e.target.value as typeof draft.publication})}><option value="DIRECT">Direkt veröffentlichen</option><option value="APPROVAL">Nach Moderationsfreigabe</option><option value="HIDDEN">Antwort erst bei Auflösung</option></Select></label>
    </fieldset>
   </section>
   <section className={styles.workspace} aria-labelledby="matching-table-title">
    <div className={styles.workspaceHeader}>
     <div><h2 id="matching-table-title">Zahlen & Inhalte</h2><p>Was sieht das Publikum – und was steht auf der Karte?</p></div>
     <span className={styles.count}>{changedCount} von 75 individuell belegt</span>
    </div>
    <div className={styles.rangeBar}>
     <div className={styles.presets} aria-label="Sichtbarer Zahlenbereich"><Button variant="secondary" type="button" aria-pressed={from==='1'&&to==='75'} onClick={()=>{setFrom('1');setTo('75');}}>1–75</Button><Button variant="secondary" type="button" aria-pressed={from==='1'&&to==='90'} onClick={()=>{setFrom('1');setTo('90');}}>1–90</Button></div>
     <div className={styles.rangeInputs}><label>Von<Input aria-label="Bereich von" type="number" min={1} max={90} value={from} onChange={e=>setFrom(e.target.value)}/></label><span aria-hidden="true">–</span><label>Bis<Input aria-label="Bereich bis" type="number" min={1} max={90} value={to} onChange={e=>setTo(e.target.value)}/></label></div>
     <Button variant="secondary" type="button" disabled={blocked||!visible.length} onClick={()=>setSelected(new Set(visible.map(e=>e.number)))}>Bereich auswählen</Button>
     <span className={styles.rangeHint}>Der Bereich filtert nur diese Ansicht.</span>
    </div>
    {selected.size>0&&<div className={styles.bulkBar} aria-label="Aktionen für ausgewählte Kugeln"><strong>{selected.size} ausgewählt</strong><Button variant="secondary" type="button" disabled={blocked} onClick={()=>setDraft(d=>({...d,entries:d.entries.map(e=>selected.has(e.number)?{...e,keepNumber:true}:e)}))}>Zahl beibehalten aktivieren</Button><Button variant="secondary" type="button" disabled={blocked} onClick={()=>setDraft(d=>({...d,entries:d.entries.map(e=>selected.has(e.number)?{...e,keepNumber:false}:e)}))}>Zahl beibehalten deaktivieren</Button><Button variant="ghost" type="button" onClick={()=>setSelected(new Set())}>Auswahl aufheben</Button></div>}
    {!validRange&&<p role="alert" className={styles.notice}>Bitte einen Bereich zwischen 1 und 90 angeben.</p>}
    <table className={styles.table} aria-label="Bingo-Matching-Tabelle">
     <thead><tr><th>Auswahl / Zahl</th><th>Zahl beibehalten</th><th>Präsentation</th><th>Bingokarte</th></tr></thead>
     <tbody>{visible.map(entry=>{
      const n=entry.number,media=entry.presentation.kind==='MEDIA'?entry.presentation.source:null,choices=answers[n]??[];
      return <tr key={n} data-matching-number={n} data-selected={selected.has(n)} data-number-only={entry.keepNumber}>
       <td className={styles.numberCell}><label className={styles.numberLabel}><input type="checkbox" aria-label={`Kugel ${n} auswählen`} checked={selected.has(n)} onChange={e=>setSelected(old=>{const s=new Set(old);if(e.target.checked)s.add(n);else s.delete(n);return s;})}/><strong className={styles.ball}>{n}</strong></label>{n>75&&<span className={styles.outside}>Außerhalb 75er-Modus</span>}</td>
       <td className={styles.keepCell}><label className={styles.keepLabel}><input type="checkbox" aria-label={`Kugel ${n}: Zahl beibehalten`} disabled={blocked} checked={entry.keepNumber} onChange={e=>update(n,{keepNumber:e.target.checked})}/><span>Zahl beibehalten</span></label></td>
       <td className={styles.presentationCell}><span className={styles.mobileLabel}>Präsentation</span><fieldset disabled={blocked}>
        <div className={styles.mediaControl}><label className="sr-only" htmlFor={`kind-${n}`}>Präsentationsart Kugel {n}</label><Select id={`kind-${n}`} value={entry.presentation.kind} onChange={e=>update(n,{sameText:e.target.value==='TEXT'?entry.sameText:false,...(e.target.value==='TEXT'?{answerKey:'custom'}:{}),presentation:e.target.value==='TEXT'?{kind:'TEXT',text:''}:{kind:'MEDIA',source:null}})}><option value="TEXT">Text</option><option value="MEDIA">Medium aus Quizbestand</option></Select>{entry.presentation.kind==='MEDIA'&&<IconButton className={styles.searchButton} icon={MagnifyingGlassIcon} label={`Kugel ${n}: Aus Quizbestand auswählen`} title="Aus Quizbestand auswählen" onClick={()=>setSourceNumber(n)}/>}</div>
        {entry.presentation.kind==='TEXT'?<Input aria-label={`Präsentationstext Kugel ${n}`} placeholder={entry.keepNumber?`Alternativer Text für ${n}`:'Text fürs Publikum'} maxLength={120} value={entry.presentation.text} onChange={e=>update(n,{presentation:{kind:'TEXT',text:e.target.value}})}/>:<p className={styles.mediaDescription}>{media?matchingVariantLabel(media.variant):'Über die Lupe ein Medium auswählen'}</p>}
       </fieldset>{media&&<details className={styles.preview}><summary>Vorschau</summary><MatchingPreview kind={media.kind} url={media.assetId?`/api/bingo/matching/${data.gameId}/assets/${media.assetId}`:`/api/bingo/matching/${data.gameId}/source/${media.questionId}/${media.mediaId}`}/></details>}</td>
       <td className={styles.cardCell}><span className={styles.mobileLabel}>Bingokarte</span><fieldset disabled={blocked||entry.presentation.kind==='TEXT'&&entry.sameText}>
        <Select aria-label={`Kartenantwort Kugel ${n}`} value={entry.answerKey} onFocus={()=>void loadAnswers(entry)} onChange={e=>{const answer=choices.find(a=>a.key===e.target.value);update(n,{answerKey:e.target.value,...(answer?{text:answer.text}:{})});}}>{entry.answerKey!=='custom'&&!choices.some(a=>a.key===entry.answerKey)&&<option value={entry.answerKey}>{entry.answerKey?`Gespeicherte Antwort — ${entry.text}`:'Kartenantwort neu auswählen …'}</option>}{choices.map(a=><option key={a.key} value={a.key}>{a.label} — {a.text}</option>)}<option value="custom">Eigener Text</option></Select>
        {entry.answerKey==='custom'&&<Input aria-label={`Eigener Kartentext Kugel ${n}`} placeholder="Text auf der Karte" maxLength={120} value={entry.presentation.kind==='TEXT'&&entry.sameText?entry.presentation.text:entry.text} onChange={e=>update(n,{text:e.target.value})}/>}</fieldset>
        {entry.presentation.kind==='TEXT'&&<label className={styles.sameText}><input type="checkbox" aria-label={`Kugel ${n}: Gleicher Text`} disabled={blocked} checked={entry.sameText} onChange={e=>update(n,{sameText:e.target.checked})}/>Gleicher Text wie in der Präsentation</label>}
        <p className={styles.printed}>Gedruckt: <strong>{printedMatchingText(entry)||'Beschriftung fehlt'}</strong></p>{errors.has(n)&&<p role="alert" className={styles.error}>{errors.get(n)}</p>}
       </td>
      </tr>;
     })}</tbody>
    </table>
    <p className={styles.footnote}>Kugelnummern bleiben die Spielgrundlage. 76–90 werden gespeichert, im 75er-Bingo aber weder gezogen noch gedruckt.</p>
   </section>
   {data.locked&&<p className={styles.notice}>Bereits verwendete Karten und Durchläufe bleiben unverändert. Zum Ändern eine neue Runde anlegen.</p>}
   <div className={styles.saveBar}>
    <div className={styles.saveState}><CheckIcon aria-hidden="true"/><span>{pending?'Wird gespeichert …':dirty?'Ungespeicherte Änderungen':'Keine ungespeicherten Änderungen'}{message&&<small role="status">{message}</small>}{errors.size>0&&<small role="alert">{errors.size} Zeilen prüfen – auch außerhalb des sichtbaren Bereichs.</small>}</span></div>
    <div className={styles.saveActions}><Link href={`/bingo/${data.gameId}/vorbereitung`}>Abbrechen</Link><Button className={styles.saveButton} type="submit" disabled={blocked||!dirty||errors.size>0}><ArrowDownTrayIcon aria-hidden="true"/>Zuordnungssatz speichern</Button></div>
   </div>
  </form>
  {sourceNumber!==null&&<SourcePicker gameId={data.gameId} entry={draft.entries[sourceNumber-1]} onClose={()=>setSourceNumber(null)} onApply={(entry,items)=>{update(entry.number,entry);setAnswers(a=>({...a,[entry.number]:items}));setSourceNumber(null);}}/>}
 </div>;
}
