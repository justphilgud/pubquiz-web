"use client";

import { useState } from "react";

import type { MemeLiveState } from "@/app/quiz/memeCaption";
import { closeUntimedMemeSubmissionPhaseAction } from "@/app/quiz/memeModerationActions";

type Props = {
  quizId: number;
  quizFragenId: number;
  state: MemeLiveState;
  onChange: (state: MemeLiveState) => void;
};

export default function MemeSubmissionControls({
  quizId,
  quizFragenId,
  state,
  onChange,
}: Props) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (state.timerEnabled || state.state === "LOCKED") return null;

  async function closeSubmissions() {
    setPending(true);
    setMessage(null);
    try {
      const result = await closeUntimedMemeSubmissionPhaseAction({
        quizId,
        quizFragenId,
      });
      onChange({ ...state, state: result.state, deadlineAt: result.deadlineAt });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Einreichungen konnten nicht beendet werden.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-cyan-500/50 bg-cyan-950/30 p-4" data-meme-submission-controls>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Meme-Einreichungen</h2>
          <p className="mt-1 text-sm text-zinc-300">
            {state.state === "OPEN"
              ? "Ohne Zeitbegrenzung geöffnet."
              : "Einreichungen sind serverseitig beendet."}
          </p>
        </div>
        {state.state === "OPEN" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void closeSubmissions()}
            className="min-h-11 rounded-xl bg-cyan-600 px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            {pending ? "Wird beendet …" : "Einreichungen beenden"}
          </button>
        ) : null}
      </div>
      {message ? (
        <p role="alert" className="mt-3 rounded-xl border border-red-400/60 bg-red-950/50 p-3 text-sm text-red-100">
          {message}
        </p>
      ) : null}
    </section>
  );
}
