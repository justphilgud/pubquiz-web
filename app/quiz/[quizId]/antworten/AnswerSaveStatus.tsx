"use client";

import type { DraftEntry } from "../../interaction/answerDraftController";
import { draftStatusText } from "../../interaction/useAnswerDrafts";
import type { ResolvedQuizAnswerInteraction } from "../../answerInteraction";
import type { TeamAnswerDraft } from "./GenericAnswerRenderer";

function summary(value: TeamAnswerDraft, interaction?: ResolvedQuizAnswerInteraction) {
  if (interaction && "items" in interaction && value.antwortText) {
    try {
      const ids: unknown = JSON.parse(value.antwortText);
      if (Array.isArray(ids)) return ids.map(id => interaction.items.find(item => item.id === id)?.text ?? "Eintrag").join(" → ");
    } catch { /* Show ordinary text below. */ }
  }
  if (interaction && "options" in interaction) {
    const ids = value.antwortIds ?? (value.antwortId === null ? [] : [value.antwortId]);
    return interaction.options.filter(option => ids.includes(option.id)).map(option => option.label).join(" · ") || "Keine Auswahl";
  }
  if (value.antwortText) return value.antwortText;
  const fields = Object.values(value.antwortfelder).filter(Boolean);
  if (fields.length) return fields.join(" · ");
  const selected = value.antwortIds?.length ?? (value.antwortId === null ? 0 : 1);
  return selected ? `${selected} Auswahl(en)` : "Keine Antwort";
}

export default function AnswerSaveStatus({ entry, onRetry, onResolve, interaction, showConfirmed = false }: {
  entry: DraftEntry;
  interaction?: ResolvedQuizAnswerInteraction;
  showConfirmed?: boolean;
  onRetry: () => void;
  onResolve: (choice: "server" | "local") => void;
}) {
  const needsDecision = ["conflict", "recovered", "closed"].includes(entry.status);
  return <div className="space-y-2 text-sm" aria-live="polite" aria-atomic="true" data-save-status={entry.status}>
    <p className="font-semibold">{draftStatusText(entry)}</p>
    {showConfirmed && entry.status === "saved" && <p className="whitespace-pre-wrap break-words">{summary(entry.serverValue, interaction)}</p>}
    {needsDecision && <>
      <p className="whitespace-pre-wrap break-words"><strong>Auf diesem Gerät:</strong> {summary(entry.value, interaction)}</p>
      <p className="whitespace-pre-wrap break-words"><strong>Zuletzt bestätigt:</strong> {summary(entry.serverValue, interaction)}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-lg border border-current px-3 py-2" onClick={() => onResolve("server")}>Gespeicherte Antwort verwenden</button>
        {entry.writable && <button type="button" className="min-h-11 rounded-lg border border-current px-3 py-2 font-semibold" onClick={() => onResolve("local")}>Eigene Änderung übernehmen und speichern</button>}
      </div>
    </>}
    {entry.status === "error" && entry.writable && <button type="button" className="min-h-11 rounded-lg border border-current px-3 py-2" onClick={onRetry}>Erneut speichern</button>}
  </div>;
}
