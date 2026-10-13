"use client";

import { useRef } from "react";
import { Select } from "@/components/ui/Select";
import type { QuestionAnswerDraft, QuestionEditorDraft, QuestionTemplate } from "../types";

export function MusicAnswerScope({ draft, template, disabled, onChange }: {
  draft: QuestionEditorDraft; template: QuestionTemplate; disabled: boolean;
  onChange: (scope: "SINGLE" | "ARTIST_TITLE", answers: QuestionAnswerDraft[]) => void;
}) {
  const retainedPair = useRef<QuestionAnswerDraft[] | null>(null);
  const retainedSingle = useRef<QuestionAnswerDraft[] | null>(null);
  const scope = draft.templateConfig.musicAnswerScope ?? "ARTIST_TITLE";
  return <section className="rounded-xl border border-slate-200 p-4">
    <label className="block text-sm font-medium">Antwortumfang
      <Select className="mt-2" disabled={disabled} value={scope} onChange={event => {
        const next = event.target.value as "SINGLE" | "ARTIST_TITLE";
        if (next === "SINGLE") {
          retainedPair.current = draft.answers;
          const first = draft.answers[0];
          const single = first ? draft.answers.filter(answer => (answer.fieldGroupId ?? answer.id) === (first.fieldGroupId ?? first.id))
            .map(answer => ({ ...answer, fieldLabel: "Richtige Antwort", isRequired: true, isCorrect: true })) : [];
          onChange(next, retainedSingle.current ?? single);
        } else {
          retainedSingle.current = draft.answers;
          const defaults = template.initialAnswers.length === 2 ? template.initialAnswers : [{ fieldLabel: "Interpret" }, { fieldLabel: "Titel" }];
          const pair = retainedPair.current ?? defaults.map((answer, index) => ({
            id: crypto.randomUUID(), fieldGroupId: crypto.randomUUID(),
            fieldLabel: answer.fieldLabel || (index === 0 ? "Interpret" : "Titel"),
            text: "", additionalInfo: "", isCorrect: true, isRequired: true, media: null,
          }));
          onChange(next, pair);
        }
      }}>
        <option value="SINGLE">Eine Antwort</option>
        <option value="ARTIST_TITLE">Interpret und Titel</option>
      </Select>
    </label>
    <p className="mt-2 text-sm text-slate-600">{scope === "SINGLE"
      ? "Eine richtige Antwort, zum Beispiel Titel, Interpret oder Serie. Beim Speichern wird ausschließlich diese Antwort übernommen."
      : "Interpret und Titel sind beide erforderlich; ihre bisherigen Teilpunkte bleiben erhalten."}</p>
    <p className="mt-1 text-xs text-slate-500">Beim Umschalten bleiben die zwei bisherigen Antworten bis zum Verlassen des Editors erhalten. Nach Speichern und Neuladen gelten nur die gespeicherten Felder.</p>
  </section>;
}
