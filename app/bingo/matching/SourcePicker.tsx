'use client';
/* eslint-disable @next/next/no-img-element -- Authorized media preview, no image optimizer or filename. */
import {useEffect,useRef,useState} from 'react';
import {Modal,Button,Input,Select} from '@/components/ui';
import {findMatchingSources,getMatchingSource,getMatchingTemplates} from './actions';
import type {MatchingSourceResult,MatchingSourceView} from './source.server';
import MatchingTemplateSelect from './MatchingTemplateSelect';
import type {MatchingTemplateOption} from './templateOptions';
import {createMatchingRequestLane} from './sourceRequests';
import {matchingVariantLabel,type MatchingEntry,type SourceAnswer} from '../preparation/matching';
import styles from './MatchingEditor.module.css';

export function MatchingPreview({kind,url}:{kind:string;url:string}){
 if(kind==='IMAGE')return <img src={url} alt="Ausgewählter Präsentationsinhalt" className="max-h-48 max-w-full object-contain"/>;
 return kind==='AUDIO'?<audio controls preload="none" src={url} aria-label="Medium probehören" className="max-w-full"/>:<video controls preload="none" src={url} aria-label="Medium in der Vorschau" className="max-h-48 max-w-full"/>;
}
type SearchState='loading'|'ready'|'error';
const sourceError='Quelle konnte nicht geladen werden. Bitte erneut auswählen und aktuelle Rechte prüfen.';
export default function SourcePicker({gameId,entry,onClose,onApply}:{gameId:string;entry:MatchingEntry;onClose:()=>void;onApply:(entry:MatchingEntry,answers:SourceAnswer[])=>void}){
 const [filters,setFilters]=useState({search:'',template:'',kind:'',page:1,refresh:0});
 const [items,setItems]=useState<MatchingSourceResult[]>([]),[more,setMore]=useState(false),[searchState,setSearchState]=useState<SearchState>('loading'),[searchError,setSearchError]=useState('');
 const [templates,setTemplates]=useState<MatchingTemplateOption[]>([]),[templateState,setTemplateState]=useState<SearchState>('loading'),[templateError,setTemplateError]=useState(''),[templateRetry,setTemplateRetry]=useState(0);
 const [question,setQuestion]=useState<MatchingSourceView|null>(null),[mediaId,setMediaId]=useState(''),[answerKey,setAnswerKey]=useState(entry.answerKey),[own,setOwn]=useState(entry.text),[sourcePending,setSourcePending]=useState(false),[message,setMessage]=useState('');
 const [searchLane]=useState(createMatchingRequestLane),[sourceLane]=useState(createMatchingRequestLane),[templateLane]=useState(createMatchingRequestLane);
 const applying=useRef(false);
 useEffect(()=>{
  const timer=setTimeout(()=>templateLane.request(()=>getMatchingTemplates(gameId),result=>{
   if(result.success){setTemplates(result.items);setTemplateState('ready');}else{setTemplateError(result.message);setTemplateState('error');}
  },()=>{setTemplateError('Vorlagen konnten nicht geladen werden. Bitte erneut versuchen.');setTemplateState('error');}),0);
  return()=>{clearTimeout(timer);templateLane.invalidate();};
 },[gameId,templateRetry,templateLane]);
 useEffect(()=>{
  const timer=setTimeout(()=>searchLane.request(()=>findMatchingSources(gameId,{search:filters.search,template:'',templateCode:filters.template,kind:filters.kind,page:filters.page}),result=>{
   if(result.success){setItems(result.items);setMore(result.more);setSearchState('ready');}else{setSearchError(result.message);setSearchState('error');}
  },()=>{setSearchError('Quellen konnten nicht geladen werden. Bitte erneut versuchen.');setSearchState('error');}),250);
  return()=>{clearTimeout(timer);searchLane.invalidate();};
 },[gameId,filters,searchLane]);
 useEffect(()=>()=>sourceLane.invalidate(),[sourceLane]);
 function changeFilters(change:Partial<typeof filters>){
  searchLane.invalidate();sourceLane.invalidate();applying.current=false;setSourcePending(false);setQuestion(null);setMessage('');setItems([]);setMore(false);setSearchError('');setSearchState('loading');
  setFilters(old=>({...old,page:1,...change}));
 }
 function close(){searchLane.invalidate();sourceLane.invalidate();templateLane.invalidate();onClose();}
 function choose(id:number){
  if(applying.current)return;
  setSourcePending(true);setQuestion(null);setMessage('');
  sourceLane.request(()=>getMatchingSource(gameId,id),result=>{
   setSourcePending(false);
   if(!result.success||!('id' in result.item)){setMessage(sourceError);return;}
   const available=result.item;setQuestion(available);setMediaId(available.media.length===1?String(available.media[0].id):'');
   const same=entry.presentation.kind==='MEDIA'&&entry.presentation.source?.questionId===id&&entry.presentation.source.revision===available.revision;
   setAnswerKey(same&&available.answers.some(a=>a.key===entry.answerKey)?entry.answerKey:available.answers.length===1?available.answers[0].key:'');
   setMessage(available.media.length?'':'Für diese Quelle ist keine ladbare Mediendatei vorhanden.');
  },()=>{setSourcePending(false);setMessage(sourceError);});
 }
 const medium=question?.media.find(m=>m.id===Number(mediaId)),answer=question?.answers.find(a=>a.key===answerKey),text=answerKey==='custom'?own:answer?.text??'';
 function apply(){
  if(applying.current||!question||!medium||!answerKey||!text.trim())return;
  applying.current=true;setSourcePending(true);setMessage('');
  // Fresh authorization and actual file availability, immediately before altering the editor draft.
  sourceLane.request(()=>getMatchingSource(gameId,question.id),result=>{
   applying.current=false;setSourcePending(false);
   if(!result.success||!('id' in result.item)){setMessage('Nicht übernommen. '+sourceError);return;}
   const fresh=result.item,stillAvailable=fresh.media.some(m=>m.id===medium.id&&m.kind===medium.kind&&m.variant===medium.variant);
   if(fresh.revision!==question.revision||!stillAvailable||(answerKey!=='custom'&&!fresh.answers.some(a=>a.key===answerKey&&a.text===text))){setMessage('Die Quelle wurde geändert oder das Medium ist nicht mehr verfügbar. Bitte Quelle erneut auswählen. Deine bisherigen Eingaben bleiben erhalten.');return;}
   onApply({...entry,keepNumber:false,sameText:false,text,answerKey,presentation:{kind:'MEDIA',source:{questionId:fresh.id,revision:fresh.revision,mediaId:medium.id,variant:medium.variant,kind:medium.kind}}},fresh.answers);
  },()=>{applying.current=false;setSourcePending(false);setMessage('Nicht übernommen. '+sourceError);});
 }
 return <Modal className={styles.picker} open title={`Kugel ${entry.number}: Aus Quizbestand auswählen`} onClose={close}>
  <form className={styles.sourceFilters} onSubmit={e=>{e.preventDefault();changeFilters({refresh:filters.refresh+1});}}>
   <label>Frage suchen<Input value={filters.search} onChange={e=>changeFilters({search:e.target.value})} maxLength={120}/></label>
   <MatchingTemplateSelect options={templates} value={filters.template} onChange={template=>changeFilters({template})} disabled={templateState!=='ready'}/>
   {templateState==='loading'&&<p role="status">Vorlagen werden geladen …</p>}
   {templateState==='error'&&<div role="alert"><p>{templateError}</p><Button type="button" variant="secondary" onClick={()=>{setTemplateState('loading');setTemplateError('');setTemplateRetry(n=>n+1);}}>Vorlagen erneut laden</Button></div>}
   {templateState==='ready'&&!templates.length&&<p>Keine Vorlagen aus passenden berechtigten Quellen vorhanden.</p>}
   <label>Medientyp<Select value={filters.kind} onChange={e=>changeFilters({kind:e.target.value})}><option value="">Alle Medien</option><option value="AUDIO">Audio</option><option value="IMAGE">Bild</option><option value="VIDEO">Video</option></Select></label>
   <p className={styles.sourceHint}>Nur freigegebene globale Quellen und Quellen dieser Eventreihe mit deinem aktuellen Quiz-Zugriff.</p>
   <Button type="submit">Suchen</Button>
  </form>
  <div className={styles.sourceResults} aria-busy={searchState==='loading'}>
   {searchState==='loading'&&<p role="status">Quellen werden gesucht …</p>}
   {searchState==='error'&&<div role="alert"><p>{searchError}</p><Button type="button" variant="secondary" onClick={()=>changeFilters({page:filters.page,refresh:filters.refresh+1})}>Suche erneut versuchen</Button></div>}
   {searchState==='ready'&&!items.length&&<p role="status">Keine passenden berechtigten Quellen für diese Filter.</p>}
   {items.map(q=><button type="button" key={q.id} aria-pressed={question?.id===q.id} disabled={sourcePending&&question!==null} onClick={()=>choose(q.id)}>{q.title}<span>{q.template}</span></button>)}
  </div>
  <div className={styles.sourcePages}>{filters.page>1&&<Button type="button" variant="secondary" disabled={searchState==='loading'} onClick={()=>changeFilters({page:filters.page-1})}>Zurück</Button>}{more&&<Button type="button" variant="secondary" disabled={searchState==='loading'} onClick={()=>changeFilters({page:filters.page+1})}>Weitere Quellen</Button>}</div>
  {sourcePending&&<p role="status">Quelle wird geprüft …</p>}
  {question&&<section className={styles.sourceDetails}>
   <h3>{question.title}</h3><p className={styles.sourceHint}>{question.template}</p>
   <label>Medium und Variante<Select value={mediaId} disabled={sourcePending} onChange={e=>setMediaId(e.target.value)}><option value="">Medium auswählen …</option>{question.media.map(m=><option key={m.id} value={m.id}>{matchingVariantLabel(m.variant)} · {m.kind}</option>)}</Select></label>
   {medium&&<p>Gewählte Variante: <strong>{matchingVariantLabel(medium.variant)}</strong></p>}
   {question.browserSpeechOnly&&<p>Keine gespeicherte Audioaufnahme vorhanden. Browser-Sprachausgabe ist keine Audiodatei und wird nicht übernommen.</p>}
   {medium&&<MatchingPreview key={`${question.id}:${medium.id}`} kind={medium.kind} url={`/api/bingo/matching/${gameId}/source/${question.id}/${medium.id}`}/>}
   <label>Bingokarte<Select value={answerKey} disabled={sourcePending} onChange={e=>setAnswerKey(e.target.value)}><option value="">Kartenantwort auswählen …</option>{question.answers.map(a=><option key={a.key} value={a.key}>{a.label} — {a.text}</option>)}<option value="custom">Eigener Text</option></Select></label>
   {answerKey==='custom'&&<label>Eigener Text<Input value={own} disabled={sourcePending} maxLength={120} onChange={e=>setOwn(e.target.value)}/></label>}
   <p>Gedruckt: <strong>{text||'Bitte Kartenantwort auswählen'}</strong></p>
   <Button type="button" disabled={sourcePending||!medium||!text.trim()||!answerKey} onClick={apply}>Zuordnung übernehmen</Button>
  </section>}
  {message&&<p role="alert" className={styles.sourceMessage}>{message}</p>}
 </Modal>;
}
