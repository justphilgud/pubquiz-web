import Link from "next/link";
import type { ReactNode } from "react";
export type EventEntry = { id: string; title: string; seriesName: string; typeLabel: string; date: string | null; time?: string | null; status: string; prepareHref: string; prepareTitle?:string; moderationHref?: string; presentationHref?: string };
/** Shared presentation only: policies and side-effect-free readers own authorization/status. */
export function EventRow({entry,children}:{entry:EventEntry;children?:ReactNode}) {
 return <article className="min-w-0 rounded-xl border border-slate-300 bg-white p-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-bold"><Link className="underline underline-offset-4" href={entry.prepareHref}>{entry.title}</Link></h2><p className="text-sm text-slate-600">{entry.seriesName} · {entry.typeLabel}</p></div><span className="rounded-md border border-slate-400 px-2 py-1 text-sm">{entry.status}</span></div>
  <p className="my-3 text-sm">Termin: {entry.date ? entry.date.split("-").reverse().join(".") : "Datum fehlt"}{entry.time?` · ${entry.time} Uhr`:""}</p>
  <nav aria-label={`Ansichten für ${entry.title}`} className="flex flex-wrap gap-2"><Link title={entry.prepareTitle??"Vorbereiten"} href={entry.prepareHref} className="inline-flex min-h-11 items-center rounded-lg border border-slate-400 px-3">Vorbereiten</Link>{entry.moderationHref&&<Link href={entry.moderationHref} className="inline-flex min-h-11 items-center rounded-lg border border-slate-400 px-3">Moderation</Link>}{entry.presentationHref&&<Link href={entry.presentationHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-slate-400 px-3">Präsentation</Link>}</nav>{children}
 </article>;
}
