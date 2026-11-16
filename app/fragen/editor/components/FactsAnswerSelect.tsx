"use client";

import { CountrySelect } from "@/components/ui/CountrySelect";
import { YEAR_MIN, YEAR_MAX } from "../templates/factsTemplate";

type Props = { kind: "YEAR" | "COUNTRY"; value: string; disabled: boolean; onChange: (value: string) => void; label?: string };
const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 disabled:bg-slate-100";

const yearOptions = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, index) => {
  const year = YEAR_MIN + index;
  return <option key={year} value={year}>{year}</option>;
});

export function FactsAnswerSelect({ kind, value, disabled, onChange, label }: Props) {
  if (kind === "COUNTRY") return <CountrySelect value={value} disabled={disabled} onChange={onChange} label={label ?? "Land"} />;
  return (
    <label className="block text-sm font-medium">
      {label ?? "Jahr"}
      <select className={fieldClass + " mt-1"} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Bitte auswählen</option>
        {yearOptions}
      </select>
    </label>
  );
}