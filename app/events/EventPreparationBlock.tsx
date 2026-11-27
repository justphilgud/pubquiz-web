import type { ReactNode } from 'react';

/** Layout slots only: each format keeps persistence, permissions and ordering. */
export function EventPreparationBlock({title,marker,description,tone='round',dragHandle,actions,children}:{title:string;marker:string;description?:string;tone?:'intro'|'outro'|'round';dragHandle?:ReactNode;actions?:ReactNode;children?:ReactNode}) {
  const colors=tone==='intro'?'border-sky-200 bg-sky-50/70':tone==='outro'?'border-violet-200 bg-violet-50/70':'border-slate-200 bg-slate-50';
  return <section className={`rounded-2xl border shadow-sm ${colors}`} aria-label={title}>
    <header className="flex flex-wrap items-start gap-2 p-3 sm:items-center">
      {dragHandle??<span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-white/80 px-2 text-xs font-black uppercase text-slate-500">{marker}</span>}
      <div className="min-w-0 flex-1"><h2 className="font-black text-slate-900">{title}</h2>{description&&<p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>}</div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </header>
    {children&&<div className="border-t border-slate-200 p-3">{children}</div>}
  </section>;
}
