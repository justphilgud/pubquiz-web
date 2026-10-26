"use client";
import Link from "next/link";
import { useCallback, useId, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
export type SeriesOption = { id: number; name: string };
/** Controlled field or real collection links; never an object assignment mutation. */
export default function EventSeriesPicker({ options, value, label = "Eventreihe filtern", onChange, hrefForValue, name }: { options: readonly SeriesOption[]; value: number | null; label?: string; onChange?: (id: number | null) => void; hrefForValue?: (id: number | null) => string; name?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const close = useCallback(() => setOpen(false), []);
  const { containerRef, triggerRef } = useDismissiblePopover({ open, onClose: close });
  const id = useId();
  const selected = options.find(option => option.id === value);
  const visible = options.filter(option => option.name.toLocaleLowerCase("de-DE").includes(query.trim().toLocaleLowerCase("de-DE")));
  function choose(next: number | null) { onChange?.(next); close(); triggerRef.current?.focus(); }
  const itemClass = "flex min-h-11 w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600";
  function item(next: number | null, text: string) { return hrefForValue ? <Link href={hrefForValue(next)} onClick={close} aria-current={value === next ? "true" : undefined} className={itemClass}>{text}</Link> : <button type="button" onClick={() => choose(next)} aria-pressed={value === next} className={itemClass}>{text}</button>; }
  return <div ref={containerRef} className="relative min-w-0 max-w-full">
    <span id={`${id}-label`} className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
    {name && <input type="hidden" name={name} value={value ?? ""} />}
    <button ref={triggerRef} type="button" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(current => !current)} className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><span id={`${id}-value`} className="truncate" title={selected?.name}>{value === null ? "Alle erlaubten Reihen" : selected?.name ?? "Nicht verfügbare Eventreihe"}</span><span aria-hidden>▾</span></button>
    {open && <div id={id} className="absolute left-0 top-full z-40 mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"><label className="block text-xs font-semibold">Eventreihen durchsuchen<input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></label><ul aria-label="Passende Eventreihen" className="mt-1 max-h-[min(18rem,40dvh)] overflow-y-auto"><li>{item(null, "Alle erlaubten Reihen")}</li>{visible.map(option => <li key={option.id}>{item(option.id, option.name)}</li>)}</ul>{!visible.length && <p className="p-2 text-sm text-slate-600">Keine passende Eventreihe.</p>}</div>}
  </div>;
}
export function EventSeriesFormField({ options, initialValue, name }: { options: SeriesOption[]; initialValue: number | null; name: string }) {
  const [value, setValue] = useState(initialValue);
  return <EventSeriesPicker options={options} value={value} onChange={setValue} name={name} />;
}
