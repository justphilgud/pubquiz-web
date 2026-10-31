'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import BingoBoard from '@/app/bingo/live/BingoBoard';
import {getPresentationTemplate} from '@/app/rendering/templateRegistry';
import type {AudienceView} from '@/app/bingo/live/repository.server';
import {SCENES,sceneFor} from '@/app/bingo/animation/catalog';
import styles from './gallery.module.css';
export function galleryFixture(templateId='phil-gud',id='gudi-gallery'):AudienceView{
 const template=getPresentationTemplate(templateId)!;
 return {id,revision:0,startedAt:1,status:'RUNNING',label:'Gudi · isolierte Animationsreferenz',target:75,draws:[],claims:[],assetBase:null,
 design:{version:1,templateId,name:templateId,config:{version:1,tokens:template.tokens,design:template.design,surfaces:{presentation:template.variant,moderation:'BRANDED',answerForm:'BRANDED'}}}};
}
/** All controls affect local synthetic observations only. No API, commands, DB or live session. */
export default function Gallery(){
 const [data,setData]=useState(()=>galleryFixture()),[number,setNumber]=useState(3),[brand,setBrand]=useState('phil-gud');
 const [connected,setConnected]=useState(true),[reduce,setReduce]=useState(false),[playing,setPlaying]=useState(false),[mount,setMount]=useState(0),[notice,setNotice]=useState('Bereit · ausschließlich synthetische Ereignisse');
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),pending=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),serial=useRef(0),latest=useRef(data);
 useEffect(()=>{latest.current=data;},[data]);
 const publish=useCallback((n:number)=>{
  if(pending.current)clearTimeout(pending.current);setNumber(n);setNotice(`Bestätigte synthetische Veröffentlichung: ${n}`);
  const old=latest.current,duplicate=old.draws.some(d=>d.number===n),base=duplicate?galleryFixture(brand,`gudi-gallery-${++serial.current}`):old;
  if(duplicate)setData(base);
  const update=()=>setData({...base,revision:base.revision+1,draws:[...base.draws,{id:`synthetic-${++serial.current}`,number:n,position:base.draws.length+1}]});
  if(duplicate)pending.current=setTimeout(update,70);else update();
 },[brand]);
 useEffect(()=>{if(!playing)return;timer.current=setTimeout(()=>{if(number>=75){setPlaying(false);setNotice('Galeriedurchlauf abgeschlossen · kein Spielabschluss');}else publish(number+1);},sceneFor(number).duration+650);return()=>clearTimeout(timer.current);},[playing,number,publish]);
 useEffect(()=>()=>{clearTimeout(pending.current);clearTimeout(timer.current);},[]);
 useEffect(()=>{const stop=()=>{if(document.visibilityState==='hidden'){setPlaying(false);setNotice('Galerie angehalten, da der Tab nicht sichtbar ist');}};document.addEventListener('visibilitychange',stop);return()=>document.removeEventListener('visibilitychange',stop);},[]);
 const choose=(n:number)=>{setPlaying(false);publish(Math.max(1,Math.min(75,n)));};
 const changeBrand=(id:string)=>{setBrand(id);setData(old=>({...old,design:galleryFixture(id).design}));};
 const correction=()=>{const old=latest.current,last=old.draws.at(-1);if(!last)return;const replacement=SCENES.find(s=>!old.draws.some(d=>d.number===s.number))?.number;if(!replacement)return;setData({...old,revision:old.revision+1,draws:old.draws.map(d=>d.id===last.id?{...d,number:replacement}:d)});setNotice(`Korrektur derselben Ziehungs-ID auf ${replacement} · darf nicht animieren`);};
 const reconnect=()=>{setConnected(false);setNotice('Unterbrochen · Wiederverbindung überspringt historische Szenen');clearTimeout(pending.current);pending.current=setTimeout(()=>{const old=latest.current;const n=SCENES.find(s=>!old.draws.some(d=>d.number===s.number))?.number??number;setData({...old,revision:old.revision+1,draws:[...old.draws,{id:`synthetic-${++serial.current}`,number:n,position:old.draws.length+1}]});setConnected(true);setNotice('Wiederverbunden · neuer bestätigter Stand ruhig übernommen');},500);};
 const scene=sceneFor(number);
 return <main className={styles.gallery} data-quiz-theme-version="1">
  <header className={styles.toolbar}><strong>Gudi · 75 Szenen · Arbeitsstand V1.1</strong><span>Nur lokale Referenzdaten · stumm · keine Speicherung</span>
   <label>Zahl<select aria-label="Szene auswählen" value={number} onChange={e=>choose(Number(e.target.value))}>{SCENES.map(s=><option key={s.number} value={s.number}>{s.number} · {s.motif}</option>)}</select></label>
   <label>Design<select aria-label="Galeriedesign" value={brand} onChange={e=>changeBrand(e.target.value)}><option value="phil-gud">Phil Gud</option><option value="lovd-ungegoogelt">LOVD</option></select></label>
   <button onClick={()=>choose(number-1)} disabled={number===1}>Vorherige</button><button onClick={()=>choose(number)}>Wiederholen</button><button onClick={()=>choose(number+1)} disabled={number===75}>Nächste</button>
   <button onClick={()=>{if(playing){setPlaying(false);setMount(x=>x+1);clearTimeout(pending.current);}else{publish(1);setPlaying(true);}}}>{playing?'Gesamtdurchlauf stoppen':'Gesamtdurchlauf starten'}</button>
   <label><input type="checkbox" checked={reduce} onChange={e=>setReduce(e.target.checked)}/>Reduzierte Bewegung</label>
  </header>
  <div className={styles.stage}><BingoBoard key={mount} data={data} connected={connected} animationPreview={{reduce:reduce?true:undefined}}/></div>
  <footer className={styles.inspector}><details><summary>Ereignisprüfung und Storyboard · {number}: {scene.motif}</summary><div className={styles.events}>
   <button onClick={()=>choose(number)}>Neue Ziehung</button><button onClick={()=>{setData(old=>({...old}));setNotice('Identische Nachricht · darf nicht erneut animieren');}}>Doppelte Nachricht</button>
   <button onClick={()=>{setMount(x=>x+1);setNotice('Neu geöffnet mit vorhandenem Stand · darf nicht animieren');}}>Neu öffnen</button><button onClick={reconnect}>Wiederverbindung</button><button onClick={correction}>Historische Korrektur</button>
   <p>{scene.relation}. {scene.preparation} {scene.action} {scene.punchline} {scene.reaction}</p><p>Alle Szenen sind zur gestalterischen Abnahme bestimmt. Technische und visuelle Prüfnachweise stehen im PR; keine automatische Qualitätsabnahme.</p></div></details><span role="status">{notice}</span></footer>
 </main>;
}
