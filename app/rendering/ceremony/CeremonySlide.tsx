'use client';
/* eslint-disable @next/next/no-img-element -- Original partner artwork, no cropping. */
import {useEffect,useState} from 'react';
import QRCode from 'react-qr-code';
import {PrizeReveal} from './PrizeReveal';
import {PodiumCeremony} from '../presentation/PodiumCeremony';
import {BookingSlide} from '../presentation/BookingSlide';
import type {CeremonyState} from './ceremony';
import {LOVD_LIGHT_LOGO,PHIL_PRINT_LOGO} from '@/app/bingo/preparation/bingoPrint';
import styles from './ceremony.module.css';
import {buildPublicCalendarSubscriptionUrl} from '@/app/calendar/publicCalendar';
import {PHIL_GUD} from '@/app/branding/philGud';
import {SynchronizedMedia} from '../presentation/PresentationSlideRenderer';

export type CeremonyWinner={number:number;cardCode:string;roundLabel:string};
export default function CeremonySlide({state,title,winner}:{state:CeremonyState;title:string;winner?:CeremonyWinner|null}){
  const [now,setNow]=useState<number|null>(null),[origin,setOrigin]=useState('');
  useEffect(()=>{const initial=setTimeout(()=>{setOrigin(window.location.origin);setNow(Date.now());},0);const timer=setInterval(()=>setNow(Date.now()),1000);return()=>{clearTimeout(initial);clearInterval(timer);};},[]);
  const c=state.config,remaining=c.startsAt&&now!==null?Math.max(0,Math.ceil((Date.parse(c.startsAt)-now)/1000)):null;
  const qr=state.slide==='questionSubmission'?origin+'/frage-einreichen':origin?buildPublicCalendarSubscriptionUrl(origin):'';
  return <section className={styles.stage} aria-label="Veranstaltungsrahmen" data-ceremony-slide={state.slide}>
    <style>{`@font-face{font-family:"Ceremony Display";src:url("${PHIL_GUD.displayFontSource}") format("woff");font-display:swap}`}</style><header><strong>{title}</strong><div><img src={LOVD_LIGHT_LOGO} alt="LOVD"/><img src={PHIL_PRINT_LOGO} alt="Phil Gud"/></div></header>
    <main>
      {state.slide==='waiting'&&<><p>Gleich geht’s los</p><h1>{c.waiting}</h1>{c.startsAt&&<p>Beginn: {new Date(c.startsAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'})} Uhr</p>}</>}
      {state.slide==='waiting'&&c.introVideoUrl&&<video className={styles.waitingVideo} src={c.introVideoUrl} autoPlay muted loop playsInline/>}
      {state.slide==='countdown'&&<><p>Der Abend beginnt in</p><h1 className={styles.countdown} aria-live="off">{remaining===null?'Gleich geht’s los':`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`}</h1></>}
      {state.slide==='welcome'&&<><p>Willkommen</p><h1>{c.welcome}</h1></>}
      {state.slide==='rules'&&<><h1>So spielen wir</h1><p className={styles.copy}>{c.rules}</p></>}
      {state.slide==='prizes'&&<><h1>Heute gibt es was zu gewinnen</h1><PrizeReveal prizes={c.prizes} revealCount={state.revealCount}/></>}
      {state.slide==='announcements'&&<><h1>Bis zum nächsten Mal</h1><p className={styles.copy}>{c.announcements}</p></>}
      {(state.slide==='questionSubmission'||state.slide==='calendar')&&<><h1>{state.slide==='questionSubmission'?'Eure Frage fürs nächste Quiz':'Die nächsten Veranstaltungen'}</h1><p>{state.slide==='questionSubmission'?'Anonym möglich · jede Frage wird redaktionell geprüft.':'Termine direkt im Kalender abonnieren.'}</p>{origin&&<div className={styles.qr}><QRCode value={qr} size={300}/></div>}</>}
      {state.slide==='booking'&&<BookingSlide/>}
      {(state.slide==='countdown'&&c.introMusicUrl||state.slide==='announcements'&&c.outroMusicUrl)&&<SynchronizedMedia kind="audio" src={(state.slide==='countdown'?c.introMusicUrl:c.outroMusicUrl)!} command={state.media?.action??'stop'} commandId={state.media?.commandId??0} renderMode="PRESENTATION" loop={state.slide==='announcements'}/>}
      {state.slide==='raffle'&&<>
        {state.revealCount===0&&<><p>Unser Hauptpreis</p><h1>{c.mainPrize}</h1></>}
        {state.revealCount===1&&<><p>Alle bestätigten Bingos des Abends sind dabei</p><h1>Die Abschlussziehung</h1><p>Jetzt wird die Losnummer aus der Bingotrommel gezogen.</p></>}
        {state.revealCount>=2&&winner&&<><p>{c.mainPrize} · Los {winner.number} · {winner.roundLabel}</p>{state.revealCount===2?<h1 className={styles.winner}>{winner.cardCode}</h1>:<div className={styles.podium}><PodiumCeremony scores={[{teamname:`Karte ${winner.cardCode}`,punkte:1}]} revealCount={1} showPoints={false}/></div>}</>}
      </>}
    </main>
    <footer>LOVD × Phil Gud</footer>
  </section>;
}
