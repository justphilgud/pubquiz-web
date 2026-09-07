"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { QUIZ_LIFECYCLE_LABELS } from "../../../quizLifecycle";
import type { PresentationLiveState } from "@/app/rendering/presentation/presentationLiveState";
import { resolvePresentationLiveState } from "@/app/rendering/presentation/presentationLiveState";
import { resetQuizDurchlauf, starteQuiz } from "../../praesentation/statusActions";

export default function QuizLifecycleControls({ quizId, state, onChange }: {
  quizId: number;
  state: PresentationLiveState;
  onChange: (state: PresentationLiveState) => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  async function run(reset: boolean) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const status = reset
        ? await resetQuizDurchlauf(quizId, state.lifecycleRevision, true)
        : await starteQuiz(quizId, state.lifecycleRevision);
      onChange(resolvePresentationLiveState(status));
      setConfirmReset(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aktion fehlgeschlagen.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return <div className="flex flex-wrap items-center gap-3">
    <span role="status">{QUIZ_LIFECYCLE_LABELS[state.lifecycle]}</span>
    {state.lifecycle === "PREPARATION" && <button className="min-h-11 rounded-lg bg-cyan-300 px-4 font-semibold text-zinc-950" disabled={pending} onClick={() => void run(false)}>Quiz starten</button>}
    <button className="min-h-11 rounded-lg border border-zinc-700 px-4" disabled={pending} onClick={() => setConfirmReset(true)}>Quiz zurücksetzen</button>
    {error && <p role="alert">{error}</p>}
    <ConfirmDialog open={confirmReset} title="Quiz zurücksetzen?" danger confirmLabel={pending ? "Wird zurückgesetzt …" : "Durchlauf zurücksetzen"} onClose={() => { if (!pending) setConfirmReset(false); }} onConfirm={() => void run(true)}>
      <p>Alle Anmeldungen, Antworten, Abgaben und Bewertungen dieses Quizdurchlaufs werden unwiderruflich gelöscht. Fragen und Blöcke werden geschlossen, Timer und Präsentation auf den Anfang gesetzt. Das Quiz ist danach wieder in Vorbereitung. Quizinhalt und globale Teamkonten bleiben erhalten.</p>
    </ConfirmDialog>
  </div>;
}
