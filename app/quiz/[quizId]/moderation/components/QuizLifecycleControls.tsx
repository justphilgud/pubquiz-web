"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { QUIZ_LIFECYCLE_LABELS } from "../../../quizLifecycle";
import type { PresentationLiveState } from "@/app/rendering/presentation/presentationLiveState";
import { resolvePresentationLiveState } from "@/app/rendering/presentation/presentationLiveState";
import { resetQuizDurchlauf, starteQuiz } from "../../praesentation/statusActions";

export default function QuizLifecycleControls({ quizId, state, onChange, onRequestEnd }: {
  quizId: number;
  state: PresentationLiveState;
  onChange: (state: PresentationLiveState) => void;
  onRequestEnd: () => void;
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
  return <div role="group" aria-label="Quiz-Lifecycle" className="flex flex-wrap items-center gap-1.5 text-sm">
    <span role="status" className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-200">{QUIZ_LIFECYCLE_LABELS[state.lifecycle]}</span>
    {state.lifecycle === "PREPARATION" && <button className="min-h-9 rounded-lg bg-cyan-300 px-3 font-semibold text-zinc-950 hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" disabled={pending} onClick={() => void run(false)}>Quiz starten</button>}
    {state.lifecycle === "RUNNING" && <Button type="button" variant="danger" className="min-h-9 px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300" disabled={pending} onClick={onRequestEnd}>Quiz beenden</Button>}
    <button className="min-h-9 rounded-lg border border-rose-400/30 px-3 text-rose-200 hover:bg-rose-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300" disabled={pending} onClick={() => setConfirmReset(true)}>Quiz zurücksetzen</button>
    {error && <p role="alert">{error}</p>}
    <ConfirmDialog open={confirmReset} title="Quiz zurücksetzen?" danger confirmLabel={pending ? "Wird zurückgesetzt …" : "Durchlauf zurücksetzen"} onClose={() => { if (!pending) setConfirmReset(false); }} onConfirm={() => void run(true)}>
      <p>Alle Anmeldungen, Antworten, Abgaben und Bewertungen dieses Quizdurchlaufs werden unwiderruflich gelöscht. Fragen und Blöcke werden geschlossen, Timer und Präsentation auf den Anfang gesetzt. Das Quiz ist danach wieder in Vorbereitung. Quizinhalt und globale Teamkonten bleiben erhalten.</p>
    </ConfirmDialog>
  </div>;
}
