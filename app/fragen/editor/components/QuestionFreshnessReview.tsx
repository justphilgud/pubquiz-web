"use client";

import { useState, useTransition } from "react";
import { confirmQuestionFreshness } from "../questionLifecycleActions";
import { shiftDateInput } from "../questionLifecycle";

const errorMessages = {
  INVALID_DATE: "Der nächste Prüfzeitpunkt muss in der Zukunft liegen.",
  NOT_FOUND: "Die Frage ist nicht mehr als prüfbedürftig markiert.",
  PERMISSION_DENIED: "Dir fehlt die Berechtigung für diese Bestätigung.",
  CONFLICT: "Die Frage wurde zwischenzeitlich geändert. Lade die Seite neu und prüfe den aktuellen Stand.",
} as const;

export function QuestionFreshnessReview({
  questionId,
  expectedUpdatedAt,
  reviewFrom,
  today,
  hasUnsavedChanges,
  onConfirmed,
}: {
  questionId: number;
  expectedUpdatedAt: string;
  reviewFrom: string;
  today: string;
  hasUnsavedChanges: boolean;
  onConfirmed: (nextReviewFrom: string | null, updatedAt: string) => void;
}) {
  const [nextReviewFrom, setNextReviewFrom] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  if (reviewFrom > today) return null;

  return (
    <section className="rounded-2xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950">
      <h2 className="font-semibold">Redaktionelle Prüfung fällig</h2>
      <p className="mt-1">Die Frage bleibt nutzbar, soll aber auf Aktualität geprüft werden.</p>
      <label className="mt-4 block max-w-sm">
        <span className="font-medium">Nächste Prüfung (optional)</span>
        <input
          type="date"
          min={shiftDateInput(today, 1)}
          value={nextReviewFrom}
          onChange={(event) => setNextReviewFrom(event.target.value)}
          className="mt-2 w-full rounded-xl border border-sky-300 bg-white px-4 py-3"
        />
      </label>
      <button
        type="button"
        disabled={pending || hasUnsavedChanges}
        onClick={() => startTransition(async () => {
          const result = await confirmQuestionFreshness({
            questionId,
            expectedUpdatedAt,
            nextReviewFrom: nextReviewFrom || null,
          });
          if (!result.ok) {
            setMessage(errorMessages[result.code]);
            return;
          }
          onConfirmed(result.nextReviewFrom, result.updatedAt);
          setMessage("Prüfung bestätigt.");
        })}
        className="mt-3 min-h-11 rounded-xl bg-sky-900 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Wird bestätigt …" : "Geprüft – weiterhin aktuell"}
      </button>
      {hasUnsavedChanges && <p className="mt-2">Speichere zuerst deine offenen Änderungen.</p>}
      {message && <p role="status" className="mt-2 font-medium">{message}</p>}
    </section>
  );
}
