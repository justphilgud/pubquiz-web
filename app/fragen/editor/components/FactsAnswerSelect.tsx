"use client";

import { CountrySelect } from "@/components/ui/CountrySelect";
import { useState } from "react";
import { isValidYear } from "../templates/factsTemplate";

type Props = { kind: "YEAR" | "COUNTRY"; value: string; disabled: boolean; onChange: (value: string) => void; label?: string };
const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 disabled:bg-slate-100";

export function FactsAnswerSelect({ kind, value, disabled, onChange, label }: Props) {
  const [enteringMinus, setEnteringMinus] = useState(false);
  if (kind === "COUNTRY") return <CountrySelect value={value} disabled={disabled} onChange={onChange} label={label ?? "Land"} />;
  return (
    <label className="block text-sm font-medium">
      {label ?? "Jahr"}
      <input
        type="text"
        className={fieldClass + " mt-1"}
        value={value || (enteringMinus ? "-" : "")}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "-") {
            setEnteringMinus(true);
            onChange("");
          } else if (next === "" || isValidYear(next)) {
            setEnteringMinus(false);
            onChange(next);
          }
        }}
        onBlur={() => setEnteringMinus(false)}
      />
    </label>
  );
}