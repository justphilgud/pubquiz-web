'use client';
import {useState} from 'react';
import {bingoNumber,parseNumberInput} from './numberDisplay';
import type {Draw} from '../core/round';
import type {EventCommand} from './eventRun';
import styles from './EventModerationPanel.module.css';

export default function DrawCorrection({draws,disabled,onCorrect}:{draws:readonly Draw[];disabled:boolean;onCorrect:(command:Extract<EventCommand,{kind:'correct'}>)=>void}) {
  const [selected,setSelected]=useState(''),[value,setValue]=useState(''),[reason,setReason]=useState('');
  const draw=draws.find(d=>d.id===selected),number=parseNumberInput(value);
  const conflict=number!==null&&draws.some(d=>d.number===number&&d.id!==selected);
  const valid=number!==null&&!conflict&&number!==draw?.number;
  return <details><summary>Frühere Ziehung korrigieren</summary><ol className={styles.drawHistory}>{draws.map(d=><li key={d.id}><button disabled={disabled} onClick={()=>{setSelected(d.id);setValue(String(d.number));setReason('');}}><span>Ziehung {d.position}</span><strong>{bingoNumber(d.number)}</strong></button></li>)}</ol>
    {draw&&<form onSubmit={e=>{e.preventDefault();if(valid&&reason.trim())onCorrect({kind:'correct',drawId:draw.id,number:number!,reason});}}><p>Ziehung {draw.position}: {bingoNumber(draw.number)} → {bingoNumber(number)}</p><label>Richtige Zahl<input type="text" inputMode="numeric" pattern="[0-9]+" required value={value} onChange={e=>setValue(e.target.value)} disabled={disabled}/></label><label>Begründung<input required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} disabled={disabled}/></label>{conflict&&<p role="alert">Diese Zahl wurde an anderer Position bereits gezogen.</p>}{value&&number===null&&<p role="alert">Nur ganze Zahlen von 1 bis 75.</p>}<button disabled={disabled||!valid||!reason.trim()}>Korrektur speichern</button><button type="button" onClick={()=>setSelected('')}>Abbrechen</button></form>}
  </details>;
}
