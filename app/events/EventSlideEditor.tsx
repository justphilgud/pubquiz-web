'use client';
import type { ReactNode } from 'react';

/** Mirrors Quiz's FixedSlideEditor structure without importing Quiz actions or changing Quiz. */
export function EventSlideEditor({title,eyebrow,backLabel,items,selected,onSelect,onCancel,children}:{title:string;eyebrow:string;backLabel:string;items:{id:string;label:string;enabled:boolean}[];selected:string;onSelect:(id:string)=>void;onCancel:()=>void;children:ReactNode}){
 return <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 md:px-8"><div className="mx-auto max-w-7xl">
  <header className="mb-6"><div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-700">{eyebrow}</div><h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{title}</h1><button type="button" onClick={onCancel} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm">{backLabel}</button></header>
  <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]"><nav aria-label={`${title}-Slides`} className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:block lg:space-y-2">{items.map((item,index)=><button key={item.id} type="button" aria-current={item.id===selected?'step':undefined} onClick={()=>onSelect(item.id)} className={`min-h-11 min-w-44 rounded-xl border p-4 text-left lg:block lg:w-full ${item.id===selected?'border-cyan-400 bg-cyan-50 text-slate-900':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><div className="text-xs font-black uppercase text-slate-400">Slide {index+1}</div><div className="font-bold">{item.label}</div><div className="mt-2 text-xs">{item.enabled?'Aktiv':'Deaktiviert'}</div></button>)}</nav><section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">{children}</section></div>
 </div></main>;
}
