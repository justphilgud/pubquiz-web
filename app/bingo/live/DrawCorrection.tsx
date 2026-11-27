'use client';
import {useState} from 'react';
import {bingoNumber,parseNumberInput} from './numberDisplay';
import type {Draw} from '../core/round';
import type {EventCommand} from './eventRun';
import styles from './EventModerationPanel.module.css';
import {sortDraws,type DrawSort} from './drawHistory';

export default function DrawCorrection({draws,disabled,onCorrect}:{draws:readonly Draw[];disabled:boolean;onCorrect:(command:Extract<EventCommand,{kind:'correct'}>)=>void}) {
  const [selected,setSelected]=useState(''),[value,setValue]=useState('');
  const [sort,setSort]=useState<DrawSort>('ORDER_DESC');
  const draw=draws.find(d=>d.id===selected),number=parseNumberInput(value);
  const conflict=number!==null&&draws.some(d=>d.number===number&&d.id!==selected);
  const valid=number!==null&&!conflict&&number!==draw?.number;
  return <section aria-label="Ziehungshistorie"><div className={styles.historyHeading}><h3>Ziehungshistorie</h3><label>Sortierung<select value={sort} onChange={e=>setSort(e.target.value as DrawSort)}><option value="ORDER_DESC">Neueste Ziehung zuerst</option><option value="ORDER_ASC">Älteste Ziehung zuerst</option><option value="NUMBER_ASC">Zahlenwert aufsteigend</option><option value="NUMBER_DESC">Zahlenwert absteigend</option></select></label></div><ol className={styles.drawHistory}>{sortDraws(draws,sort).map(d=><li key={d.id}><button aria-label={`Ziehung ${d.position}: ${bingoNumber(d.number)} korrigieren`} disabled={disabled} onClick={()=>{setSelected(d.id);setValue(String(d.number));}}><span>#{d.position}</span><strong>{bingoNumber(d.number)}</strong><span aria-hidden="true">✎</span></button></li>)}</ol>{!draws.length&&<p>Noch keine Ziehung.</p>}
    {draw&&<form onSubmit={e=>{e.preventDefault();if(valid)onCorrect({kind:'correct',drawId:draw.id,number:number!,reason:''});}}><p>Ziehung {draw.position}: {bingoNumber(draw.number)} → {bingoNumber(number)}</p><label>Richtige Zahl<input type="text" inputMode="numeric" pattern="[0-9]+" required value={value} onChange={e=>setValue(e.target.value)} disabled={disabled}/></label>{conflict&&<p role="alert">Diese Zahl wurde an anderer Position bereits gezogen.</p>}{value&&number===null&&<p role="alert">Nur ganze Zahlen von 1 bis 75.</p>}<button disabled={disabled||!valid}>Korrektur speichern</button><button type="button" onClick={()=>setSelected('')}>Abbrechen</button></form>}
  </section>;
}
