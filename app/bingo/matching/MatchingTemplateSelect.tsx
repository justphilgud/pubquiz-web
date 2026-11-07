'use client';
import {useEffect,useId,useState} from 'react';
import {ChevronDownIcon,CheckIcon} from '@heroicons/react/24/outline';
import {useDismissiblePopover} from '@/app/components/useDismissiblePopover';
import type {MatchingTemplateOption} from './templateOptions';
import styles from './MatchingEditor.module.css';

export default function MatchingTemplateSelect({options,value,onChange,disabled}:{options:MatchingTemplateOption[];value:string;onChange:(code:string)=>void;disabled:boolean}){
 const id=useId(),[query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0);
 const {containerRef,triggerRef}=useDismissiblePopover<HTMLInputElement>({open,onClose:()=>setOpen(false)});
 const choices=[{code:'',name:'Alle Vorlagen'},...options].filter(o=>o.name.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')));
 useEffect(()=>{if(open)document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:'nearest'});},[active,id,open,query]);
 function choose(code:string){onChange(code);setOpen(false);setQuery('');triggerRef.current?.focus();}
 return <div ref={containerRef} className={styles.templatePicker}>
  <label htmlFor={id}>Fragevorlage</label>
  <div className={styles.comboInput}>
   <input ref={triggerRef} id={id} role="combobox" aria-describedby={value?`${id}-selected`:undefined} aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open&&choices[active]?`${id}-option-${active}`:undefined} disabled={disabled}
    value={open?query:options.find(o=>o.code===value)?.name??'Alle Vorlagen'} placeholder="Vorlage suchen …"
    onClick={()=>{setOpen(true);setQuery('');setActive(0);}}
    onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0);}}
    onKeyDown={e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);}
     else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(i=>Math.max(0,Math.min(choices.length-1,open?i+(e.key==='ArrowDown'?1:-1):0)));}
     else if(e.key==='Enter'&&open){e.preventDefault();if(choices[active])choose(choices[active].code);}}}/>
   <ChevronDownIcon aria-hidden="true"/>
  </div>
  {value&&<p id={`${id}-selected`} className={styles.selectedTemplate}>Gewählte Vorlage: <strong>{options.find(o=>o.code===value)?.name??'Nicht mehr verfügbar'}</strong></p>}
  {open&&<div id={`${id}-list`} role="listbox" aria-label="Fragevorlagen" className={styles.options}>
   {choices.map((o,i)=><button key={o.code} type="button" role="option" tabIndex={-1} id={`${id}-option-${i}`} aria-selected={value===o.code} data-active={i===active} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o.code)}>{o.name}{value===o.code&&<CheckIcon aria-hidden="true"/>}</button>)}
   {!choices.length&&<p>Keine passende Vorlage.</p>}
  </div>}
 </div>;
}
