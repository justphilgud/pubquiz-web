'use client';
import {useEffect,useState} from 'react';
import {PlayIcon,PauseIcon,ArrowPathIcon} from '@heroicons/react/24/solid';
import {IconButton} from '@/components/ui';
import {matchingVariantLabel,printedMatchingText,type MatchingEntry} from '../preparation/matching';
import {MatchingPreview} from '../matching/SourcePicker';
import type {EventCommand} from './eventRun';
export default function MatchingModeration({gameId,runId,number,entry,drawId,publication,revealed,disabled,onCommand}:{gameId:string;runId:string;number:number|null;entry:MatchingEntry|null;drawId?:string;publication:string;revealed:boolean;disabled:boolean;onCommand:(command:EventCommand)=>void}){
 const [preview,setPreview]=useState<{number:number;entry:MatchingEntry}|null>(null);
 useEffect(()=>{if(number===null)return;const controller=new AbortController(),timer=setTimeout(()=>{void fetch(`/api/bingo/matching/${gameId}/content?run=${runId}&number=${number}`,{signal:controller.signal}).then(async r=>{if(r.ok){const value:MatchingEntry=await r.json();if(!controller.signal.aborted)setPreview({number,entry:value});}}).catch(()=>{});},250);return()=>{clearTimeout(timer);controller.abort();};},[gameId,runId,number]);
 const selected=number!==null?preview?.number===number?preview.entry:null:entry;
 if(!selected)return <p>Zuordnung wird bei Bedarf geladen.</p>;
 const source=selected.presentation.kind==='MEDIA'?selected.presentation.source:null;
 return <section aria-label="Matching-Inhalt" className="space-y-2"><p>Kugel {selected.number} · Kartenbeschriftung: <strong>{printedMatchingText(selected)}</strong></p><p>Präsentation: {selected.keepNumber?selected.number:selected.presentation.kind==='TEXT'?selected.presentation.text:source?matchingVariantLabel(source.variant):'Medium fehlt'}</p>
 {!selected.keepNumber&&source&&<details><summary>Medium in der Moderation prüfen</summary><MatchingPreview kind={source.kind} url={`/api/bingo/matching/${gameId}/assets/${source.assetId}`}/></details>}
 {number===null&&drawId&&!selected.keepNumber&&source&&source.kind!=='IMAGE'&&<div className="flex flex-wrap gap-2"><IconButton icon={PlayIcon} label="Präsentationsmedium starten" disabled={disabled} onClick={()=>onCommand({kind:'playback',drawId,action:'PLAY'})}/><IconButton icon={PauseIcon} label="Präsentationsmedium pausieren" disabled={disabled} onClick={()=>onCommand({kind:'playback',drawId,action:'PAUSE'})}/><IconButton icon={ArrowPathIcon} label="Präsentationsmedium erneut abspielen" disabled={disabled} onClick={()=>onCommand({kind:'playback',drawId,action:'REPLAY'})}/></div>}
 {number===null&&drawId&&publication==='HIDDEN'&&!revealed&&<button type="button" disabled={disabled} onClick={()=>onCommand({kind:'reveal',drawId})}>Begriff auflösen</button>}</section>;
}
