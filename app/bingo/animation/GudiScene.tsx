'use client';
import {useId,useLayoutEffect,useRef,type CSSProperties} from 'react';
import {contrastRatio} from '@/app/rendering/presentationTemplates/presentationTemplate';
import {Gudi,Prop} from './artwork';
import {choreography} from './choreography';
import {sceneFor} from './catalog';
import {sample,sampleTrack} from './timeline';
import styles from './animation.module.css';
export default function GudiScene({number,onDone,observedAt,rate=1,frame}:{number:number;onDone:()=>void;observedAt:number;rate?:number;frame?:number}){
 const ballId=useId(),ref=useRef<SVGSVGElement>(null),score=choreography(number),scene=sceneFor(number);
 useLayoutEffect(()=>{
  const svg=ref.current,owner=svg?.closest<HTMLElement>("[data-animation-number]");if(!svg||!owner)return;
  if(performance.now()-observedAt>750){onDone();return;}
  let raf=0,disposed=false;const started=performance.now();
  const actors=[...svg.querySelectorAll<SVGGElement>('[data-actor]')];
  const primary=getComputedStyle(owner).getPropertyValue('--bingo-primary').trim(),initialInk=contrastRatio('#171717',primary)>=4.5?[23,23,23]:[250,248,242];
  const paint=(progress:number)=>{
   svg.dataset.progress=progress.toFixed(4);
   owner.style.setProperty('--gudi-number-opacity',String(Math.max(0,Math.min(1,(progress-.94)/.05))));
   actors.forEach((element,i)=>{const pose=sampleTrack(score[i],progress),fade=score[i].shape==='ball'?1:Math.max(0,Math.min(1,(.88-progress)/.1));
    element.setAttribute('transform',`translate(${pose.x} ${pose.y}) rotate(${score[i].shape==='ball'?0:pose.rotate}) scale(${pose.scaleX} ${pose.scaleY})`);
    element.setAttribute('opacity',String(pose.opacity*fade));
   });
   const ball=actors[score.findIndex(actor=>actor.shape==='ball')],value=ball?.querySelector('text'),still=owner.querySelector<HTMLElement>('[data-current-number]');
   if(value&&still){
    const pose=sample(score.find(actor=>actor.shape==='ball')!.keys,progress),matrix=svg.getScreenCTM();
    const css=getComputedStyle(still),scale=owner.getBoundingClientRect().width/owner.clientWidth;
    const target=parseFloat(css.fontSize)*scale/Math.max(.001,(matrix?.a??1)*pose.scaleX);
    const u=Math.max(0,Math.min(1,(progress-.78)/.16)),ease=u*u*(3-2*u);
    value.setAttribute('font-size',String(70+(target-70)*ease));
    const rgb=css.color.match(/[\d.]+/g)?.slice(0,3).map(Number)??[250,248,242],color=Math.max(0,Math.min(1,(progress-.82)/.08));
    value.setAttribute('fill',`rgb(${rgb.map((c,i)=>Math.round(initialInk[i]+(c-initialInk[i])*color)).join(',')})`);
    ball.querySelector('[data-ball-shell]')?.setAttribute('stroke',`rgb(${initialInk.join(',')})`);
    ball.querySelectorAll('[data-ball-shell]').forEach(shell=>shell.setAttribute('opacity',String(Math.max(0,Math.min(1,(.9-progress)/.1)))));
   }
   svg.querySelector('[data-water]')?.setAttribute('transform',`scale(1 ${1+Math.min(1,Math.max(0,(progress-.32)/.22))*1.1})`);
   svg.querySelector('[data-clock-hand]')?.setAttribute('transform',`rotate(${Math.min(1,progress/.65)*90} 0 -155)`);
   svg.querySelectorAll('[data-modem-light]').forEach((light,i)=>light.setAttribute('fill',i<=Math.floor(progress*5)?'var(--gudi-accent)':'#171717'));
   svg.querySelectorAll('[data-loading-dot]').forEach((light,i)=>light.setAttribute('opacity',i<Math.floor((progress<.56?Math.min(progress,.22):progress)*9)?'1':'.25'));
   const seat=svg.querySelector('[data-tandem-seat]'),tail=progress>.4&&progress<.7?(progress-.4)/.3:1;
   seat?.setAttribute('transform',`translate(0 ${Math.sin(tail*Math.PI*2)*8*(1-tail)})`);
   // Original wink is retained. A single short blink punctuates the surprise, never a flashing loop.
   svg.querySelectorAll<SVGEllipseElement>('[data-gudi-eye]').forEach(eye=>eye.setAttribute('ry',progress>.515&&progress<.54?'9':'41'));
   svg.style.opacity=String(Math.min(1,Math.max(0,(1-progress)/.04)));
  };
  const abort=()=>{owner.style.removeProperty('--gudi-number-opacity');onDone();};
  const tick=(now:number)=>{if(disposed)return;try{const progress=Math.min(1,(now-started)*rate/scene.duration);paint(progress);if(progress<1)raf=requestAnimationFrame(tick);else onDone();}catch{abort();}};
  try{if(frame!==undefined)paint(frame);else{paint(0);raf=requestAnimationFrame(tick);}}catch{abort();}
  return()=>{disposed=true;cancelAnimationFrame(raf);owner.style.removeProperty('--gudi-number-opacity');};
 },[number,onDone,observedAt,rate,frame,score,scene.duration]);
 const variables={'--gudi-accent':'var(--bingo-primary)','--gudi-secondary':'var(--bingo-secondary)','--gudi-line':'currentColor'} as CSSProperties;
 return <svg ref={ref} className={styles.scene} style={variables} viewBox="0 0 720 720" aria-hidden="true" data-gudi-scene={number} data-motif={scene.motif}>
  <defs><radialGradient id={ballId} cx=".3" cy=".2" r=".85"><stop stopColor="#fff" stopOpacity=".38"/><stop offset=".65" stopColor="#fff" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity=".15"/></radialGradient></defs>
  <ellipse cx="360" cy="535" rx="285" ry="16" fill="currentColor" opacity=".09"/>
  {score.map((actor,i)=><g key={i} data-actor={actor.shape}>{actor.shape==='gudi'?<Gudi/>:actor.shape==='ball'?<>
   <circle data-ball-shell="true" r="52" fill="var(--bingo-primary)" stroke="#171717" strokeWidth="3"/>
   <circle data-ball-shell="true" r="52" fill={`url(#${ballId})`}/>
   <text textAnchor="middle" dominantBaseline="central" fill="#171717" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="70">{number}</text>
  </>:<Prop name={actor.shape} number={number}/>}</g>)}
 </svg>;
}
