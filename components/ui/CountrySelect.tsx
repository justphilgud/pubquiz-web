"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "./Input";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
import { COUNTRY_OPTIONS, countryName } from "@/app/lib/countries";

type Props = { value: string; onChange: (code: string) => void; disabled?: boolean; label?: string };

export function CountrySelect({ value, onChange, disabled = false, label = "Land" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { containerRef } = useDismissiblePopover<HTMLInputElement>({ open, onClose: () => setOpen(false) });
  const matches = COUNTRY_OPTIONS.filter((country) => country.label.toLocaleLowerCase("de").includes(query.trim().toLocaleLowerCase("de")));
  const activeOption = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) activeOption.current?.scrollIntoView({ block: "nearest" }); }, [active, open]);
  const choose = (code: string) => { onChange(code); setOpen(false); setQuery(""); setActive(0); };
  return <div ref={containerRef} className="relative">
    <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
    <Input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open}
      aria-controls={`${id}-list`} aria-activedescendant={open && matches[active] ? `${id}-${matches[active].value}` : undefined}
      disabled={disabled} value={open ? query : value ? countryName(value) : ""} placeholder="Land suchen und auswählen"
      className="min-h-11" onFocus={() => { setQuery(""); setActive(0); setOpen(true); }}
      onClick={() => { if (!open) { setQuery(""); setActive(0); setOpen(true); } }}
      onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive((current) => Math.max(0, Math.min(matches.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
        } else if (event.key === "Enter" && open) {
          event.preventDefault(); if (matches[active]) choose(matches[active].value);
        } else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      }} />
    {open && !disabled && <div id={`${id}-list`} role="listbox" aria-label={label} className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-300 bg-white p-1 text-slate-950 shadow-lg">
      {matches.map((country, index) => <button key={country.value} id={`${id}-${country.value}`} type="button" role="option" ref={active === index ? activeOption : undefined}
        aria-selected={country.value === value} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)}
        onClick={() => choose(country.value)} className={`min-h-11 w-full rounded-lg px-3 py-2 text-left ${active === index ? "bg-slate-100" : ""}`}>
        {country.label}{country.value === value ? " ✓" : ""}
      </button>)}
      {matches.length === 0 && <p className="p-3 text-sm">Kein Land gefunden.</p>}
    </div>}
  </div>;
}
