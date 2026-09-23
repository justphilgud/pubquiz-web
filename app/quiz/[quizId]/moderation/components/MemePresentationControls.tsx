"use client";

import { useState } from "react";

import type { MemePresentationSnapshot } from "@/app/quiz/memeVoting.server";
import type { MemePresentationTransition } from "@/app/quiz/memeVoting";
import {
  startMemePresentationAction,
  transitionMemePresentationAction,
} from "@/app/quiz/memeVotingActions";

export default function MemePresentationControls({
  quizId,
  quizFragenId,
  state,
  onChange,
}: {
  quizId: number;
  quizFragenId: number;
  state: MemePresentationSnapshot;
  onChange: (state: MemePresentationSnapshot) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setMessage(null);
    try {
      const result = await startMemePresentationAction({
        quizId,
        quizFragenId,
        selectionId: state.selectionId,
      });
      if (result.view) onChange(result.view);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Meme-Präsentation konnte nicht gestartet werden.");
    } finally {
      setPending(false);
    }
  }

  async function transition(next: MemePresentationTransition) {
    if (!state.presentationId) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await transitionMemePresentationAction({
        quizId,
        quizFragenId,
        presentationId: state.presentationId,
        expectedRevision: state.revision,
        transition: next,
      });
      if (result.view) onChange(result.view);
      if (!result.success) {
        setMessage(
          result.reason === "REVISION_CONFLICT"
            ? "Ein anderer Moderator hat den Ablauf inzwischen geändert. Der aktuelle Stand wurde geladen."
            : "Dieser Schritt ist im aktuellen Meme-Ablauf nicht zulässig.",
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Der Meme-Ablauf konnte nicht geändert werden.");
    } finally {
      setPending(false);
    }
  }

  const activeIndex = state.candidates.findIndex(
    (candidate) => candidate.number === state.activeCandidateNumber,
  );
  const lastOverviewPage = state.overviewPageCount - 1;

  return (
    <section className="rounded-2xl border border-cyan-500/50 bg-cyan-950/30 p-4" data-meme-presentation-controls>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Meme-Präsentation &amp; Voting</h2>
          <p className="mt-1 text-sm text-zinc-300">
            {state.candidates.length} freigegebene Kandidaten · stabile AP2-Nummern
          </p>
        </div>
        <span className="rounded-full border border-cyan-400/50 px-3 py-1 text-xs font-bold text-cyan-100">
          {state.phase === "READY"
            ? "Bereit"
            : state.phase === "PRESENTING"
              ? `Meme ${state.activeCandidateNumber}`
              : state.phase === "OVERVIEW"
                ? `Übersicht ${state.overviewPage + 1}/${state.overviewPageCount}`
                : state.phase === "VOTING_OPEN"
                  ? "Voting offen"
                  : "Voting geschlossen"}
        </span>
      </div>

      {message ? (
        <p role="alert" className="mt-3 rounded-xl border border-amber-400/60 bg-amber-950/50 p-3 text-sm text-amber-100">
          {message}
        </p>
      ) : null}

      {state.phase === "READY" ? (
        <button type="button" disabled={pending} onClick={() => void start()} className="mt-4 min-h-11 rounded-xl bg-cyan-600 px-4 py-2 font-bold text-white disabled:opacity-50">
          Präsentationsphase starten
        </button>
      ) : null}

      {state.phase === "PRESENTING" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={pending || activeIndex <= 0} onClick={() => void transition("PREVIOUS_CANDIDATE")} className="min-h-11 rounded-xl border border-zinc-500 px-4 py-2 font-bold disabled:opacity-40">
            Vorheriges Meme
          </button>
          <button type="button" disabled={pending} onClick={() => void transition("NEXT_CANDIDATE")} className="min-h-11 rounded-xl bg-cyan-600 px-4 py-2 font-bold text-white disabled:opacity-50">
            {activeIndex === state.candidates.length - 1 ? "Zur Übersicht" : "Nächstes Meme"}
          </button>
        </div>
      ) : null}

      {state.phase === "OVERVIEW" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={pending || state.overviewPage <= 0} onClick={() => void transition("PREVIOUS_OVERVIEW_PAGE")} className="min-h-11 rounded-xl border border-zinc-500 px-4 py-2 font-bold disabled:opacity-40">
            Vorherige Übersichtsseite
          </button>
          {state.overviewPage < lastOverviewPage ? (
            <button type="button" disabled={pending} onClick={() => void transition("NEXT_OVERVIEW_PAGE")} className="min-h-11 rounded-xl bg-cyan-600 px-4 py-2 font-bold text-white disabled:opacity-50">
              Nächste Übersichtsseite
            </button>
          ) : (
            <button type="button" disabled={pending} onClick={() => void transition("OPEN_VOTING")} className="min-h-11 rounded-xl bg-fuchsia-600 px-4 py-2 font-bold text-white disabled:opacity-50">
              Voting öffnen
            </button>
          )}
        </div>
      ) : null}

      {state.phase === "VOTING_OPEN" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-200">
            <strong>{state.progress?.votesCast ?? 0}</strong> von <strong>{state.progress?.eligibleTeams ?? 0}</strong> stimmberechtigten Teams haben abgestimmt. Keine Zwischenstände werden angezeigt.
          </p>
          <button type="button" disabled={pending} onClick={() => void transition("CLOSE_VOTING")} className="min-h-11 rounded-xl border border-red-400/70 px-4 py-2 font-bold text-red-100 disabled:opacity-50">
            Voting schließen
          </button>
        </div>
      ) : null}

      {state.phase === "VOTING_CLOSED" ? (
        <p className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-950/30 p-3 text-sm text-emerald-100">
          Das Voting ist final geschlossen. Der stabile Kandidaten- und Stimmenstand steht AP4 bereit.
        </p>
      ) : null}
    </section>
  );
}
