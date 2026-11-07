'use client';
/* eslint-disable @next/next/no-img-element -- Authorized immutable media, opaque URL and original aspect ratio. */
import {useState,useEffect,useRef} from 'react';
import {SynchronizedMedia} from '@/app/rendering/presentation/PresentationSlideRenderer';
import type {AudienceView} from './repository.server';
import styles from './board.module.css';
/** Existing Quiz media player; Bingo only supplies its own persisted command/context. */
export default function MatchingPresentation({data,connected}:{data:AudienceView;connected:boolean}){
 const [activation,setActivation]=useState<{enabled:boolean;beforeCue:string|null}>({enabled:false,beforeCue:null}),content=data.content,draw=data.draws.at(-1),cue=data.playback,root=useRef<HTMLDivElement>(null),applied=useRef<{id:string;media:HTMLMediaElement}|null>(null);
 const enabled=activation.enabled;
 useEffect(()=>{
  const media=root.current?.querySelector<HTMLMediaElement>('audio,video');if(!media||!cue||!enabled||cue.id===activation.beforeCue||applied.current?.id===cue.id&&applied.current.media===media)return;
  const received=Date.now();
  const seek=()=>{if(!Number.isFinite(media.duration)||media.duration<=0)return;const running=cue.action!=='PAUSE'&&data.status==='RUNNING';const position=cue.position+(running?Math.max(0,(data.serverAt??cue.at)-cue.at+Date.now()-received)/1000:0);media.currentTime=Math.min(media.duration,position);applied.current={id:cue.id,media};if(position>=media.duration)media.pause();};
  media.addEventListener('loadedmetadata',seek);if(media.readyState>0)seek();return()=>media.removeEventListener('loadedmetadata',seek);
 },[cue,enabled,activation.beforeCue,data.serverAt,data.status]);
 if(!content||content.kind==='TEXT')return null;
 const playable=content.kind!=='IMAGE',current=!!cue&&cue.drawId===draw?.id,command=!enabled||cue?.id===activation.beforeCue||!connected||!current||data.status==='ENDED'||data.phase==='BETWEEN'?null:data.status==='PAUSED'||cue?.action==='PAUSE'?'pause':'play';
 return <div ref={root} className={styles.matchingMedia} aria-label="Zugeordneter Präsentationsinhalt">
  {content.kind==='IMAGE'?<img key={content.url} src={content.url} alt="Bingo-Bild" onError={e=>{e.currentTarget.hidden=true;e.currentTarget.nextElementSibling?.removeAttribute('hidden');}}/>:<SynchronizedMedia key={`${draw?.id}:${cue?.restartId??''}`} kind={content.kind==='AUDIO'?'audio':'video'} src={content.url} command={command} commandId={cue?.sequence??0} renderMode="PRESENTATION" className={styles.matchingVideo} resumeContext={`bingo:${data.id}:${draw?.id}:${cue?.restartId??''}`} showCountdown={content.kind==='AUDIO'} countdownClassName="text-3xl"/>}
  {content.kind==='IMAGE'&&<p hidden role="status">Bild konnte nicht geladen werden. Bitte die Moderation informieren.</p>}
  {playable&&!enabled&&<button type="button" className={styles.mediaActivation} onClick={()=>setActivation({enabled:true,beforeCue:cue?.id??null})}>Präsentation freigeben</button>}
  {playable&&enabled&&(!current||cue?.id===activation.beforeCue)&&<p>Freigegeben · Wiedergabe in der Moderation starten.</p>}
  {content.answer&&<p className={styles.matchingAnswer}>{content.answer}</p>}
 </div>;
}
