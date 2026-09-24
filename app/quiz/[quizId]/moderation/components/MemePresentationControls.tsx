"use client";

import { forwardRef, useImperativeHandle, useState } from "react";

import type { MemePresentationSnapshot } from "@/app/quiz/memeVoting.server";
import { getNextMemeAdvanceCommand, type MemePresentationTransition } from "@/app/quiz/memeVoting";
import type { QuizSolutionStrategy } from "@/app/quiz/flow/quizFlow";
import { finalizeMemeResultAction } from "@/app/quiz/memeResultsActions";
import {
  startMemePresentationAction,
  transitionMemePresentationAction,
} from "@/app/quiz/memeVotingActions";

export type MemePresentationControlsHandle = {
  advance: () => Promise<boolean>;
};

const MemePresentationControls = forwardRef<MemePresentationControlsHandle, {
  quizId: number;
  quizFragenId: number;
  state: MemePresentationSnapshot;
  solutionStrategy: QuizSolutionStrategy;
  onChange: (state: MemePresentationSnapshot) => void;
}>(function MemePresentationControls({
  quizId,
  quizFragenId,
  state,
  solutionStrategy,
  onChange,
}, ref) {
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

  async function finalizeResult() {
    if (!state.presentationId) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await finalizeMemeResultAction({
        quizId,
        quizFragenId,
        presentationId: state.presentationId,
      });
      if (result.view) onChange(result.view);
      setMessage(
        result.alreadyFinalized
          ? "Das Meme-Ergebnis war bereits finalisiert. Der aktuelle Stand wurde geladen."
          : solutionStrategy === "END_OF_BLOCK"
            ? "Ergebnis und Punkte sind final. Die Auflösung erscheint am Blockende."
            : "Ergebnis und Punkte sind final. Du kannst jetzt zur Auflösung weitergehen.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Das Meme-Ergebnis konnte nicht finalisiert werden.");
    } finally {
      setPending(false);
    }
  }

  const activeIndex = state.candidates.findIndex(
    (candidate) => candidate.number === state.activeCandidateNumber,
  );
  const lastOverviewPage = state.overviewPageCount - 1;

  useImperativeHandle(ref, () => ({
    async advance() {
      const command = getNextMemeAdvanceCommand({
        ...state,
        hasResult: Boolean(state.result),
      });
      if (command === "NEXT_QUIZ_SLIDE") return false;
      if (command === "START_PRESENTATION") await start();
      else if (command === "FINALIZE_RESULT") await finalizeResult();
      else await transition(command);
      return true;
    },
  }));

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
        <p className="mt-4 text-sm text-zinc-200">Mit dem zentralen „Weiter“ startest du die Präsentationsphase.</p>
      ) : null}

      {state.phase === "PRESENTING" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending || activeIndex <= 0} onClick={() => void transition("PREVIOUS_CANDIDATE")} className="min-h-11 rounded-xl border border-zinc-500 px-4 py-2 font-bold disabled:opacity-40">
            Vorheriges Meme
          </button>
          <p className="text-sm text-zinc-200">„Weiter“ zeigt {activeIndex === state.candidates.length - 1 ? "die Übersicht" : "das nächste Meme"}.</p>
        </div>
      ) : null}

      {state.phase === "OVERVIEW" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={pending || state.overviewPage <= 0} onClick={() => void transition("PREVIOUS_OVERVIEW_PAGE")} className="min-h-11 rounded-xl border border-zinc-500 px-4 py-2 font-bold disabled:opacity-40">
            Vorherige Übersichtsseite
          </button>
          <p className="text-sm text-zinc-200">„Weiter“ {state.overviewPage < lastOverviewPage ? "zeigt die nächste Übersichtsseite" : "öffnet das Voting"}.</p>
        </div>
      ) : null}

      {state.phase === "VOTING_OPEN" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-200">
            <strong>{state.progress?.votesCast ?? 0}</strong> von <strong>{state.progress?.eligibleTeams ?? 0}</strong> stimmberechtigten Teams haben abgestimmt. Keine Zwischenstände werden angezeigt.
          </p>
          <p className="text-sm text-zinc-200">„Weiter“ schließt das Voting.</p>
        </div>
      ) : null}

      {state.phase === "VOTING_CLOSED" ? (
        state.result ? (
          <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-950/30 p-3 text-sm text-emerald-100">
            <p className="font-bold">Ergebnis final · {state.result.totalVotes} Stimmen</p>
            <p className="mt-1">
              {state.result.entries.some((entry) => entry.isWinner)
                ? `${state.result.entries.filter((entry) => entry.isWinner).map((entry) => `Meme ${entry.number} (${entry.teamName})`).join(", ")} erhält ${state.result.entries.filter((entry) => entry.isWinner).length === 1 ? "1 Punkt" : "je 1 Punkt"}.`
                : "Keine gültige Stimme; es wurde kein Punkt vergeben."}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-950/30 p-3 text-sm text-amber-100">
            <p>Das Voting ist geschlossen. Stimmen und Punkte sind noch nicht finalisiert.</p>
            <p className="mt-2">„Weiter“ finalisiert Ergebnis und Punkte.</p>
          </div>
        )
      ) : null}
    </section>
  );
});

export default MemePresentationControls;
