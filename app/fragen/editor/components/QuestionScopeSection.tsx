"use client";

import type { QuestionEditorDraft } from "../types";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

export type QuestionScopeOption = { id: number; name: string };

export function QuestionScopeSection({ scope, eventSeriesIds, eventSeries, canSelectGlobal, onChange }: {
  scope: QuestionEditorDraft["scope"];
  eventSeriesIds: number[];
  eventSeries: QuestionScopeOption[];
  canSelectGlobal: boolean;
  onChange: (scope: QuestionEditorDraft["scope"], eventSeriesIds: number[]) => void;
}) {
  const { messages } = useQuestionEditorMessages();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <fieldset>
        <legend className="text-lg font-semibold text-slate-950">{messages.editor.scopeTitle}</legend>
        <p className="mt-1 text-sm text-slate-600">{messages.editor.scopeHelp}</p>
        {(canSelectGlobal || scope === "GLOBAL") && <label className="mt-4 flex min-h-11 items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="radio" name="question-scope" checked={scope === "GLOBAL"} disabled={!canSelectGlobal} onChange={() => onChange("GLOBAL", [])} className="mt-1" /><span><span className="block font-semibold">{messages.editor.scopeGlobal}</span><span className="block text-sm text-slate-600">{messages.editor.scopeGlobalHelp}</span></span></label>}
        <label className="mt-3 flex min-h-11 items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="radio" name="question-scope" checked={scope === "EVENT_SERIES"} onChange={() => onChange("EVENT_SERIES", eventSeriesIds.length ? eventSeriesIds : eventSeries.length === 1 ? [eventSeries[0].id] : [])} className="mt-1" /><span><span className="block font-semibold">{messages.editor.scopeEventSeries}</span><span className="block text-sm text-slate-600">{messages.editor.scopeEventSeriesHelp}</span></span></label>
        {scope === "EVENT_SERIES" && <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {eventSeries.map((series) => <label key={series.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={eventSeriesIds.includes(series.id)} onChange={(event) => onChange("EVENT_SERIES", event.target.checked ? [...eventSeriesIds, series.id] : eventSeriesIds.filter((id) => id !== series.id))} /><span className="break-words font-medium">{series.name}</span></label>)}
          {eventSeriesIds.length === 0 && <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">{messages.editor.scopeRequired}</p>}
        </div>}
      </fieldset>
    </section>
  );
}
