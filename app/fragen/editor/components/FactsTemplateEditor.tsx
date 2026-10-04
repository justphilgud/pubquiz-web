"use client";

import type { QuestionAnswerDraft, QuestionTemplateData } from "../types";
import { FACTS_MAX, FACTS_MIN, FACT_TEXT_MAX_LENGTH, factsAnswers, type FactsTemplateData } from "../templates/factsTemplate";
import { SortableTemplateList } from "./SortableTemplateList";
import { FactsAnswerSelect } from "./FactsAnswerSelect";

type Props = { data: QuestionTemplateData | undefined; answers: readonly QuestionAnswerDraft[]; disabled: boolean; onChange: (data: QuestionTemplateData, answers: QuestionAnswerDraft[]) => void; validationError?: string | null };
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2";

export function FactsTemplateEditor(props: Props) {
  if (props.data?.kind !== "FACTS") return null;
  const data = props.data;
  const update = (next: FactsTemplateData) => props.onChange(next, factsAnswers(next, props.answers));
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="font-semibold">Fakten und Lösung</h2>
    <p className="text-sm text-slate-600">2 bis 7 Fakten, ausschließlich Text, höchstens 300 Zeichen pro Fakt. Die Reihenfolge entspricht der Präsentation.</p>
    <SortableTemplateList ids={data.facts.map((fact) => fact.id)} disabled={props.disabled}
      onReorder={(ids) => update({ ...data, facts: ids.map((id) => data.facts.find((fact) => fact.id === id)!) })}>
      {(id, index, handle) => <div className="space-y-2 rounded-xl border border-slate-200 p-3">
        <div className="flex items-center gap-2">{handle}<span className="font-medium">Fakt {index + 1}</span>
          <button type="button" className="ml-auto min-h-11 px-3" disabled={props.disabled || data.facts.length <= FACTS_MIN}
            onClick={() => update({ ...data, facts: data.facts.filter((fact) => fact.id !== id) })}>Fakt entfernen</button>
        </div>
        <textarea maxLength={FACT_TEXT_MAX_LENGTH} aria-label={`Fakt ${index + 1}`} className={inputClass} value={data.facts[index].text} disabled={props.disabled}
          onChange={(event) => update({ ...data, facts: data.facts.map((fact) => fact.id === id ? { ...fact, text: event.target.value } : fact) })} />
      </div>}
    </SortableTemplateList>
    <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-4" disabled={props.disabled || data.facts.length >= FACTS_MAX}
      onClick={() => update({ ...data, facts: [...data.facts, { id: crypto.randomUUID(), text: "" }] })}>Fakt hinzufügen</button>
    {data.response !== "TEXT" ? <FactsAnswerSelect kind={data.response} label="Richtige Lösung" value={data.solution} disabled={props.disabled}
      onChange={(solution) => update({ ...data, solution })} /> : <>
      {data.options.length === 0 && <>
        <label className="block text-sm font-medium">Hauptlösung<input className={`${inputClass} mt-1`} maxLength={200} value={data.solution} disabled={props.disabled}
          onChange={(event) => update({ ...data, solution: event.target.value })} /></label>
        <p className="text-sm text-slate-600">Akzeptierte Schreibvarianten bleiben für Teams unsichtbar.</p>
        {data.acceptedVariants.map((variant, index) => <div key={index} className="flex gap-2">
          <input aria-label={`Akzeptierte Variante ${index + 1}`} className={inputClass} maxLength={200} value={variant} disabled={props.disabled}
            onChange={(event) => update({ ...data, acceptedVariants: data.acceptedVariants.map((entry, position) => position === index ? event.target.value : entry) })} />
          <button type="button" className="min-h-11 px-3" disabled={props.disabled} onClick={() => update({ ...data, acceptedVariants: data.acceptedVariants.filter((_, position) => position !== index) })}>Entfernen</button>
        </div>)}
        <button type="button" className="min-h-11 px-3" disabled={props.disabled} onClick={() => update({ ...data, acceptedVariants: [...data.acceptedVariants, ""] })}>Schreibvariante hinzufügen</button>
      </>}
      <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-4" disabled={props.disabled}
        onClick={() => update({ ...data, acceptedVariants: [], options: data.options.length ? [] : [{ id: crypto.randomUUID(), text: data.solution, isCorrect: true }, { id: crypto.randomUUID(), text: "", isCorrect: false }] })}>
        {data.options.length ? "Zur offenen Antwort wechseln" : "Sichtbare Auswahloptionen verwenden"}
      </button>
      {data.options.length > 0 && <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Sichtbare Antwortoptionen – genau eine richtige Antwort</legend>
        {data.options.map((option, index) => <div key={option.id} className="flex items-center gap-2">
          <input type="radio" name="facts-correct-option" aria-label={`Option ${index + 1} ist richtig`} checked={option.isCorrect} disabled={props.disabled}
            onChange={() => update({ ...data, options: data.options.map((entry) => ({ ...entry, isCorrect: entry.id === option.id })) })} />
          <input aria-label={`Antwortoption ${index + 1}`} className={inputClass} maxLength={200} value={option.text} disabled={props.disabled}
            onChange={(event) => update({ ...data, options: data.options.map((entry) => entry.id === option.id ? { ...entry, text: event.target.value } : entry) })} />
          <button type="button" className="min-h-11 px-2" disabled={props.disabled || data.options.length <= 2} onClick={() => {
            const options = data.options.filter((entry) => entry.id !== option.id);
            update({ ...data, options: option.isCorrect ? options.map((entry, position) => ({ ...entry, isCorrect: position === 0 })) : options });
          }}>Entfernen</button>
        </div>)}
        <button type="button" className="min-h-11 px-3" disabled={props.disabled} onClick={() => update({ ...data, options: [...data.options, { id: crypto.randomUUID(), text: "", isCorrect: false }] })}>Antwortoption hinzufügen</button>
      </fieldset>}
    </>}
    {props.validationError && <p role="alert" className="text-sm text-red-700">{props.validationError}</p>}
  </section>;
}
