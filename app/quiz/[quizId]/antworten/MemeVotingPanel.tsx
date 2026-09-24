"use client";

import { useState } from "react";

import { MemeRenderer } from "@/app/rendering/meme/MemeRenderer";
import { submitMemeVoteAction } from "@/app/quiz/memeVotingActions";
import type { MemePresentationSnapshot } from "@/app/quiz/memeVoting.server";
import { TeamIdentityVisual } from "@/app/teams/TeamIdentityVisual";

export default function MemeVotingPanel({
  quizId,
  sessionToken,
  state,
  onChange,
}: {
  quizId: number;
  sessionToken: string;
  state: MemePresentationSnapshot;
  onChange: (state: MemePresentationSnapshot) => void;
}) {
  const [pendingCandidateId, setPendingCandidateId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function vote(candidateId: number) {
    if (!state.presentationId || state.phase !== "VOTING_OPEN") return;
    setPendingCandidateId(candidateId);
    setMessage(null);
    try {
      const result = await submitMemeVoteAction({
        quizId,
        presentationId: state.presentationId,
        candidateId,
        expectedVoteRevision: state.team?.vote?.revision ?? null,
        quizTeamSessionToken: sessionToken,
      });
      if (result.vote && state.team) {
        onChange({
          ...state,
          team: { ...state.team, vote: result.vote },
        });
      }
      if (result.success) {
        setMessage("Stimme bestätigt. Du kannst sie ändern, solange das Voting offen ist.");
      } else {
        setMessage(
          result.reason === "SELF_VOTE"
            ? "Das eigene Meme kann nicht gewählt werden."
            : result.reason === "VOTING_CLOSED"
              ? "Das Voting ist bereits geschlossen."
              : result.reason === "REVISION_CONFLICT"
                ? "Die Stimme wurde auf einem anderen Gerät geändert. Der aktuelle Stand wurde geladen."
                : "Dieser Meme-Kandidat ist für das Voting nicht gültig.",
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Stimme konnte nicht gespeichert werden.");
    } finally {
      setPendingCandidateId(null);
    }
  }

  const votingOpen = state.phase === "VOTING_OPEN";
  if (state.result) {
    const hasWinner = state.result.entries.some((entry) => entry.isWinner);
    return (
      <section className="answer-surface rounded-3xl border border-fuchsia-200 bg-white p-5 shadow-sm sm:p-6" data-meme-team-result>
        <div className="answer-kicker text-sm font-semibold uppercase tracking-wide text-fuchsia-700">Meme-Ergebnis</div>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">
          {hasWinner ? "Das Publikum hat entschieden" : "Keine gültigen Stimmen"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{state.result.totalVotes} abgegebene Stimmen · das Ergebnis ist final.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {state.result.entries.map((entry) => (
            <article key={entry.candidateId} className={`rounded-2xl border p-4 ${entry.isWinner ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center gap-3">
                <TeamIdentityVisual name={entry.teamName} photoUrl={entry.photoUrl} avatarCode={entry.avatarCode} />
                <div className="min-w-0">
                  <p className="font-bold text-slate-950">Meme {entry.number} · {entry.teamName}</p>
                  <p className="text-sm text-slate-600">{entry.voteCount} {entry.voteCount === 1 ? "Stimme" : "Stimmen"} · {entry.share.toFixed(1).replace(".0", "")} %</p>
                </div>
              </div>
              {entry.isWinner ? <p className="mt-3 font-black text-amber-900">Gewinner · +{entry.awardedPoints} Punkt</p> : null}
            </article>
          ))}
        </div>
        {!hasWinner ? <p className="mt-4 font-semibold text-slate-700">Ohne abgegebene Stimme wird kein Punkt vergeben.</p> : null}
      </section>
    );
  }
  if (!votingOpen && state.phase !== "VOTING_CLOSED") {
    return (
      <section className="answer-surface rounded-3xl border border-fuchsia-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="answer-kicker text-sm font-semibold uppercase tracking-wide text-fuchsia-700">Meme-Voting</div>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Voting noch nicht geöffnet</h2>
        <p className="mt-2 text-slate-600">Die Moderation präsentiert zunächst alle freigegebenen Memes.</p>
      </section>
    );
  }

  return (
    <section className="answer-surface rounded-3xl border border-fuchsia-200 bg-white p-5 shadow-sm sm:p-6" data-meme-team-voting>
      <div className="answer-kicker text-sm font-semibold uppercase tracking-wide text-fuchsia-700">Meme-Voting</div>
      <h2 className="mt-2 text-2xl font-bold text-slate-950">
        {votingOpen ? "Deine Stimme" : "Voting geschlossen"}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {votingOpen
          ? "Wähle genau ein fremdes Meme. Eine neue Auswahl ersetzt deine bisherige Stimme."
          : "Deine finale Stimme bleibt gespeichert und kann nicht mehr geändert werden."}
      </p>

      {message ? (
        <p role="status" className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-950">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {state.candidates.map((candidate) => {
          const own = state.team?.ownCandidateIds.includes(candidate.candidateId) ?? false;
          const selected = state.team?.vote?.candidateId === candidate.candidateId;
          const disabled = !votingOpen || own || pendingCandidateId !== null;
          return (
            <button
              key={candidate.candidateId}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => void vote(candidate.candidateId)}
              className={`rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed ${
                selected
                  ? "border-fuchsia-600 bg-fuchsia-50 ring-2 ring-fuchsia-200"
                  : own
                    ? "border-slate-200 bg-slate-100 opacity-65"
                    : "border-slate-300 bg-white hover:border-fuchsia-500"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2 text-slate-950">
                <strong>Meme {candidate.number}</strong>
                <span className="text-sm font-semibold">
                  {own ? "Eigenes Meme · gesperrt" : selected ? "Gewählt" : "Wählen"}
                </span>
              </div>
              {state.imageUrl ? (
                <MemeRenderer
                  imageUrl={state.imageUrl}
                  topText={candidate.topText}
                  bottomText={candidate.bottomText}
                  captions={candidate.captions}
                  layout={candidate.layout}
                  alt={`Meme ${candidate.number}`}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {votingOpen && state.team && !state.team.canVote ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
          Es gibt keinen fremden Kandidaten, für den dieses Team abstimmen kann. Es wird keine künstliche Selbststimme erzeugt.
        </p>
      ) : null}
    </section>
  );
}
