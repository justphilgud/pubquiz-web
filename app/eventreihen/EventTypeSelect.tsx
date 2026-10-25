"use client";

import { useId, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
import { EVENT_TYPES, type EventType } from "@/app/roles/eventTypes";

type Props = {
  enabled: readonly string[];
  onToggle: (type: EventType, enabled: boolean) => void;
  disabled?: boolean;
  name?: string;
};

/** Presentation only: the containing form/action retains all product checks. */
export function EventTypeSelect({ enabled, onToggle, disabled = false, name }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { containerRef, triggerRef } = useDismissiblePopover({ open, onClose: () => setOpen(false) });
  const label = EVENT_TYPES.filter(type => enabled.includes(type.id)).map(type => type.label).join(", ") || "Keine Eventarten ausgewählt";
  return <div className="min-w-0">
    <label id={`${id}-label`} className="mb-1 block text-sm font-semibold">Freigeschaltete Eventarten</label>
    <div ref={containerRef} className="relative">
      <button ref={triggerRef} type="button" disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(current => !current)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm disabled:bg-slate-50 disabled:text-slate-600">
        <span id={`${id}-value`}>{label}</span><span aria-hidden="true">▾</span>
      </button>
      {open && <div id={id} role="group" aria-labelledby={`${id}-label`} className="absolute z-10 mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 shadow-lg">
        {EVENT_TYPES.map(type => <label key={type.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-2 text-sm"><input type="checkbox" disabled={disabled} checked={enabled.includes(type.id)} onChange={event => onToggle(type.id, event.target.checked)} className="h-4 w-4" />{type.label}</label>)}
      </div>}
    </div>
    {name && EVENT_TYPES.filter(type => enabled.includes(type.id)).map(type => <input key={type.id} type="hidden" name={name} value={type.id} />)}
    <p className="mt-1 text-xs text-slate-500">Bingo und PowerPoint-Karaoke sind noch nicht spielbar.</p>
  </div>;
}
