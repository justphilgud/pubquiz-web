import type { QuestionAnswerDraft, QuestionTemplateData } from "../types";
import { PAIRS_MAX, PAIR_TEXT_MAX } from "../templates/pairsTemplate";

export function PairsEditor({ data, disabled, onChange, validationError }: {
  data?: QuestionTemplateData;
  disabled: boolean;
  onChange: (data: QuestionTemplateData, answers: QuestionAnswerDraft[]) => void;
  validationError?: string | null;
}) {
  if (data?.kind !== "PAIRS") return null;
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="font-semibold">Richtige Paare</h2>
    <p className="text-sm text-slate-600">2 bis {PAIRS_MAX} Paare mit je zwei eindeutigen Begriffen. Pro Begriff sind {PAIR_TEXT_MAX} Zeichen möglich.</p>
    {data.pairs.map((pair, index) => <fieldset key={pair.leftId} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <legend className="text-sm font-medium">Paar {index + 1}</legend>
      {(["left", "right"] as const).map((side) => <input
        key={side} aria-label={`Paar ${index + 1}, ${side === "left" ? "links" : "rechts"}`}
        className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2"
        value={pair[side]} maxLength={PAIR_TEXT_MAX} disabled={disabled}
        onChange={(event) => onChange({ ...data, pairs: data.pairs.map((entry) =>
          entry.leftId === pair.leftId ? { ...entry, [side]: event.target.value } : entry) }, [])}
      />)}
      <button type="button" className="min-h-11 px-3" disabled={disabled || data.pairs.length <= 2}
        onClick={() => onChange({ ...data, pairs: data.pairs.filter((entry) => entry.leftId !== pair.leftId) }, [])}>
        Entfernen
      </button>
    </fieldset>)}
    <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-4"
      disabled={disabled || data.pairs.length >= PAIRS_MAX}
      onClick={() => onChange({ ...data, pairs: [...data.pairs, {
        leftId: crypto.randomUUID(), rightId: crypto.randomUUID(), left: "", right: "",
      }] }, [])}>Paar hinzufügen</button>
    {validationError && <p role="alert" className="text-sm text-red-700">{validationError}</p>}
  </section>;
}
