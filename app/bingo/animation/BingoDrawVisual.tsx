'use client';
import {Component,Suspense,lazy,useCallback,useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import type {AudienceView} from '../live/repository.server';
import {newlyConfirmedDraw,type Observation} from './observation';
import styles from './animation.module.css';
const Scene=lazy(()=>import('./GudiScene'));
const subscribe=(listener:()=>void)=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener);};
const snapshot=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
class AnimationBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?null:this.props.children;}
}
export type AnimationPreviewOptions=Readonly<{reduce?:boolean;rate?:number;frame?:number}>;
/** Animation owns pixels only. The actual number remains the independent, always available fallback. */
export function BingoDrawVisual({data,connected=true,preview}:{data:AudienceView;connected?:boolean;preview?:AnimationPreviewOptions}){
 const ref=useRef<HTMLDivElement>(null),previous=useRef<Observation|undefined>(undefined);
 const [active,setActive]=useState<{id:string;number:number;observedAt:number}|null>(null);
 const systemReduce=useSyncExternalStore(subscribe,snapshot,()=>true),reduce=preview?.reduce??systemReduce;
 const finish=useCallback(()=>setActive(null),[]);
 useEffect(()=>{
  const next:Observation={view:data,connected:connected&&document.visibilityState==='visible'};
  const draw=newlyConfirmedDraw(previous.current,next);previous.current=next;
  const frame=requestAnimationFrame(()=>setActive(old=>reduce||!next.connected?null:draw?{id:draw.id,number:draw.number,observedAt:performance.now()}:old&&data.draws.at(-1)?.id===old.id&&data.draws.at(-1)?.number===old.number?old:null));
  return()=>cancelAnimationFrame(frame);
 },[data,connected,reduce]);
 useEffect(()=>{const hide=()=>{if(previous.current)previous.current={...previous.current,connected:false};finish();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[finish]);
 return <div className={styles.visual} ref={ref} data-animation-number={active?.number??''}>
  <strong data-current-number style={{fontFamily:"Arial, Helvetica, sans-serif",fontWeight:800,lineHeight:1.5}}>{data.draws.at(-1)?.number??'–'}</strong>
  {active&&!reduce&&connected&&data.status==="RUNNING"&&!data.phase&&data.draws.at(-1)?.id===active.id&&data.draws.at(-1)?.number===active.number&&<AnimationBoundary key={active.id}><Suspense fallback={null}><Scene number={active.number} onDone={finish} observedAt={active.observedAt} rate={preview?.rate} frame={preview?.frame}/></Suspense></AnimationBoundary>}
 </div>;
}
