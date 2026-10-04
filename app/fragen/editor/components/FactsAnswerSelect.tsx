"use client";

import { useState } from "react";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { YEAR_MIN, YEAR_MAX } from "../templates/factsTemplate";

type Props = { kind: "YEAR" | "COUNTRY"; value: string; disabled: boolean; onChange: (value: string) => void; label?: string };
const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 disabled:bg-slate-100";

export function FactsAnswerSelect({ kind, value, disabled, onChange, label }: Props) {
  const [selectedCentury, setSelectedCentury] = useState(1900);
  if (kind === "COUNTRY") return <CountrySelect value={value} disabled={disabled} onChange={onChange} label={label ?? "Land"} />;
  const century = value ? Math.floor(Number(value) / 100) * 100 : selectedCentury;
  const years = Array.from({ length: 100 }, (_, index) => century + index).filter((year) => year >= YEAR_MIN && year <= YEAR_MAX);
  return <fieldset className="space-y-2">
    <legend className="text-sm font-medium">{label ?? "Jahr"}</legend>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-sm">Jahresbereich
        <select className={`${fieldClass} mt-1`} value={century} disabled={disabled} onChange={(event) => {
          const next = Number(event.target.value); setSelectedCentury(next); onChange("");
        }}>
          {Array.from({ length: 100 }, (_, index) => index * 100).map((start) => <option key={start} value={start}>{Math.max(YEAR_MIN, start)}–{start + 99}</option>)}
        </select>
      </label>
      <label className="text-sm">Jahreszahl
        <select className={`${fieldClass} mt-1`} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="">Bitte auswählen</option>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
    </div>
  </fieldset>;
}
