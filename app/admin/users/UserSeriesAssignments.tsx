"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
import type { EventSeriesAssignmentRole } from "@/app/eventreihen/eventSeriesAccessPolicy";
import type { SelectableEventSeries } from "./eventSeriesSelectionPolicy";
import { initialSeriesDraft, seriesDraftPayload, type SeriesAssignmentDraft } from "./seriesAssignmentDraft";

type Props = {
  eventSeries: readonly SelectableEventSeries[];
  initialAssignments: readonly { eventSeriesId: number; role: EventSeriesAssignmentRole }[];
  initialManagementIds: readonly number[];
};

export function UserSeriesAssignments({ eventSeries, initialAssignments, initialManagementIds }: Props) {
  const [rows, setRows] = useState(() => initialSeriesDraft(initialAssignments, initialManagementIds));
  const [query, setQuery] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const optionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) optionsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [active, open]);
  const { containerRef, triggerRef } = useDismissiblePopover<HTMLInputElement>({ open, onClose: () => setOpen(false) });
  const payload = seriesDraftPayload(rows);
  const name = (id: number) => eventSeries.find(series => series.id === id)?.name ?? `Eventreihe #${id}`;
  const matches = (text: string, search: string) => text.toLocaleLowerCase("de").includes(search.trim().toLocaleLowerCase("de"));
  const visible = rows.filter(row => matches(name(row.eventSeriesId), query));
  const available = eventSeries.filter(series => !series.archived && !rows.some(row => row.eventSeriesId === series.id) && matches(series.name, addQuery));
  function update(id: number, patch: Partial<Pick<SeriesAssignmentDraft, "role" | "manage">>) {
    setRows(current => current.map(row => row.eventSeriesId === id ? { ...row, ...patch } : row));
  }
  function add(id: number) {
    setRows(current => current.some(row => row.eventSeriesId === id) ? current : [...current, { eventSeriesId: id, role: "", manage: false }]);
    setAddQuery(""); setOpen(false); setActive(0); triggerRef.current?.focus();
  }
  return <fieldset className="min-w-0 space-y-3 border-t border-slate-200 pt-4">
    <legend className="font-semibold">Rollen je Eventreihe</legend>
    <p className="text-sm text-slate-600">Rolle und gemeinsame Verwaltung getrennt vergeben. Änderungen werden mit dem Benutzer gespeichert.</p>
    <details className="text-sm text-slate-600">
      <summary className="min-h-8 cursor-pointer font-medium text-slate-800">Hilfe zu Reihenrechten</summary>
      <p>Die Rolle gilt für freigeschaltete Eventarten, auch nach späterer Freischaltung. Editor pflegt Inhalte, Eventmanager führt Veranstaltungen durch. Für PowerPoint-Karaoke gibt es keine Editorfunktionen. „Eventreihe verwalten“ erlaubt unabhängig davon Stammdaten und Branding. Benutzer und Produktfreischaltungen bleiben Administratoren vorbehalten.</p>
    </details>
    <input type="hidden" name="seriesRolesVersion" value="1" />
    <input type="hidden" name="eventSeriesRoles" value={JSON.stringify(payload.assignments)} />
    {payload.managementIds.map(id => <input key={id} type="hidden" name="manageEventSeriesIds" value={id} />)}
    <div ref={containerRef} className="relative">
      <label className="sr-only" htmlFor={`${listId}-add`}>Eventreihe hinzufügen …</label>
      <input id={`${listId}-add`} ref={triggerRef} type="search" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open && available[active] ? `${listId}-${available[active].id}` : undefined}
        placeholder="Eventreihe hinzufügen …" value={addQuery} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
        onFocus={() => setOpen(true)} onChange={event => { setAddQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(current => Math.max(0, Math.min(available.length - 1, open ? current + (event.key === "ArrowDown" ? 1 : -1) : 0))); }
          if (event.key === "Enter") { event.preventDefault(); if (open && available[active]) add(available[active].id); else setOpen(true); }
        }} />
      {open && <div ref={optionsRef} id={listId} role="listbox" aria-label="Verfügbare Eventreihen" className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-300 bg-white p-1 shadow-lg">
        {available.map((series, index) => <button key={series.id} id={`${listId}-${series.id}`} type="button" role="option" aria-selected={index === active} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => add(series.id)} className={`min-h-11 w-full break-words rounded px-3 py-2 text-left text-sm ${index === active ? "bg-slate-100" : ""}`}>{series.name}</button>)}
        {!available.length && <p className="p-3 text-sm text-slate-500">Keine weiteren passenden Eventreihen.</p>}
      </div>}
    </div>
    {rows.length > 0 && <label className="block text-sm"><span className="sr-only">Zuordnungen durchsuchen</span><input type="search" placeholder="Zuordnungen durchsuchen" value={query} onChange={event => setQuery(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>}
    <p role="status" className="text-xs text-slate-500">{visible.length} von {rows.length} Zuordnungen</p>
    {rows.length > 0 && <table className="block w-full text-sm sm:table">
      <caption className="sr-only">Zugeordnete Eventreihen</caption>
      <thead className="hidden text-left text-xs text-slate-600 sm:table-header-group"><tr><th scope="col" className="py-2">Eventreihe</th><th scope="col">Rolle</th><th scope="col" className="px-2">Eventreihe verwalten</th><th scope="col"><span className="sr-only">Entfernen</span></th></tr></thead>
      <tbody className="block sm:table-row-group">{visible.map(row => <tr key={row.eventSeriesId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-slate-200 py-2 sm:table-row">
        <th scope="row" className="col-span-2 break-words py-2 text-left font-medium sm:max-w-44 sm:pr-3">{name(row.eventSeriesId)}{eventSeries.find(series => series.id === row.eventSeriesId)?.archived && " (Archiviert)"}</th>
        <td className="py-1"><select aria-label={`${name(row.eventSeriesId)}: Rolle`} value={row.role} onChange={event => update(row.eventSeriesId, { role: event.target.value as SeriesAssignmentDraft["role"] })} className="min-h-11 w-full rounded-lg border border-slate-300 px-2 sm:w-36"><option value="">Kein Zugriff</option><option value="EDITOR">Editor</option><option value="EVENT_MANAGER">Eventmanager</option></select></td>
        <td className="px-2"><label className="flex min-h-11 items-center justify-center gap-2"><input type="checkbox" checked={row.manage} onChange={event => update(row.eventSeriesId, { manage: event.target.checked })} aria-label={`${name(row.eventSeriesId)}: Eventreihe verwalten`} className="h-4 w-4" /><span className="sm:sr-only">Verwalten</span></label></td>
        <td className="col-span-2 text-right"><button type="button" aria-label={`${name(row.eventSeriesId)}: Entfernen`} onClick={() => setRows(current => current.filter(item => item.eventSeriesId !== row.eventSeriesId))} className="min-h-11 rounded-lg px-2 text-sm text-red-700 hover:bg-red-50">Entfernen</button></td>
      </tr>)}</tbody>
    </table>}
    {!rows.length && <p className="text-sm text-slate-500">Keine Eventreihen zugeordnet.</p>}
    {rows.length > 0 && !visible.length && <p className="text-sm text-slate-500">Keine passenden Zuordnungen. Alle übrigen bleiben erhalten.</p>}
  </fieldset>;
}
