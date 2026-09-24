"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MemeRenderer } from "@/app/rendering/meme/MemeRenderer";
import {
  completeMemeModerationReviewAction,
  getMemeModerationViewAction,
  setMemeCandidateReviewStatusAction,
} from "@/app/quiz/memeModerationActions";
import type { MemeModerationView } from "@/app/quiz/memeModeration.server";

type Props = {
  quizId: number;
  quizFragenId: number;
  imageUrl: string;
};

const statusLabel = {
  PENDING_REVIEW: "Offen",
  APPROVED: "Freigegeben",
  REJECTED: "Ausgeschlossen",
} as const;

export default function MemeModerationReview({
  quizId,
  quizFragenId,
  imageUrl,
}: Props) {
  const [view, setView] = useState<MemeModerationView | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (pendingRef.current) return;
    try {
      const next = await getMemeModerationViewAction({ quizId, quizFragenId });
      setView(next);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Die Meme-Auswahl konnte nicht geladen werden.",
      );
    }
  }, [quizId, quizFragenId]);

  useEffect(() => {
    let active = true;
    const initial = window.setTimeout(() => {
      if (active) void refresh();
    }, 0);
    const interval = window.setInterval(() => {
      if (active) void refresh();
    }, 2_500);
    return () => {
      active = false;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function decide(
    candidateId: number,
    expectedReviewRevision: number,
    reviewStatus: "APPROVED" | "REJECTED",
  ) {
    if (view?.phase !== "REVIEW") return;
    pendingRef.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await setMemeCandidateReviewStatusAction({
        quizId,
        quizFragenId,
        selectionId: view.selectionId,
        candidateId,
        expectedReviewRevision,
        reviewStatus,
      });
      setView(result.view);
      if (!result.success) {
        setMessage(
          result.reason === "REVISION_CONFLICT"
            ? "Ein anderer Moderator hat diesen Kandidaten inzwischen geändert. Der aktuelle Stand wurde geladen."
            : "Der Review ist bereits abgeschlossen.",
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Entscheidung konnte nicht gespeichert werden.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function complete() {
    if (view?.phase !== "REVIEW") return;
    pendingRef.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await completeMemeModerationReviewAction({
        quizId,
        quizFragenId,
        selectionId: view.selectionId,
        expectedRevision: view.revision,
      });
      setView(result.view);
      if (!result.success) setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Der Review konnte nicht abgeschlossen werden.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (!view || view.phase === "UNAVAILABLE") {
    return (
      <section className="rounded-2xl border border-fuchsia-500/50 bg-fuchsia-950/30 p-4">
        <h2 className="font-bold">Meme-Auswahl</h2>
        <p className="mt-2 text-sm text-zinc-300">Auswahl wird geladen …</p>
      </section>
    );
  }
  if (view.phase === "NOT_READY") {
    return (
      <section className="rounded-2xl border border-fuchsia-500/50 bg-fuchsia-950/30 p-4">
        <h2 className="font-bold">Meme-Auswahl</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Die Auswahl wird erst nach dem serverseitigen Ende der Antwortphase erzeugt.
        </p>
      </section>
    );
  }

  const allRejected =
    view.selectedCount > 0 && view.rejectedCount === view.selectedCount;
  const locked = view.selectionState !== "REVIEWING";

  return (
    <section
      data-meme-moderation-review
      className="rounded-2xl border border-fuchsia-500/50 bg-fuchsia-950/30 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Meme-Auswahl &amp; Review</h2>
          <p className="mt-1 text-sm text-zinc-300">
            {view.selectedCount} ausgewählt · {view.approvedCount} freigegeben ·{" "}
            {view.rejectedCount} ausgeschlossen · {view.pendingCount} offen
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {view.validSubmissionCount} gültige Einreichungen ·{" "}
            {view.selectionLimit === null
              ? "Konfiguration: Alle"
              : `Limit: ${view.selectionLimit}`}
          </p>
        </div>
        <span className="rounded-full border border-fuchsia-400/50 px-3 py-1 text-xs font-bold text-fuchsia-100">
          {view.selectionState === "REVIEWING"
            ? "Review läuft"
            : view.selectionState === "COMPLETED"
              ? "Review abgeschlossen"
              : "Ohne Kandidaten abgeschlossen"}
        </span>
      </div>

      {message ? (
        <p role="alert" className="mt-3 rounded-xl border border-amber-400/60 bg-amber-950/50 p-3 text-sm text-amber-100">
          {message}
        </p>
      ) : null}
      {allRejected ? (
        <p role="alert" className="mt-3 rounded-xl border border-amber-400/60 bg-amber-950/50 p-3 text-sm text-amber-100">
          Keine Meme-Einreichung wurde für die Präsentation freigegeben. Der Review kann so nicht abgeschlossen werden.
        </p>
      ) : null}

      {view.candidates.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-300">
          Für diesen abgeschlossenen Run gibt es keine gültige Meme-Einreichung.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {view.candidates.map((candidate) => (
            <article
              key={candidate.candidateId}
              className="rounded-2xl border border-zinc-700 bg-zinc-950/45 p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong>Kandidat {candidate.position}</strong>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                  candidate.reviewStatus === "APPROVED"
                    ? "bg-emerald-950 text-emerald-200"
                    : candidate.reviewStatus === "REJECTED"
                      ? "bg-red-950 text-red-200"
                      : "bg-zinc-800 text-zinc-200"
                }`}>
                  {statusLabel[candidate.reviewStatus]}
                </span>
              </div>
              <MemeRenderer
                imageUrl={imageUrl}
                captions={candidate.captions}
                layout={candidate.layout}
                alt={`Meme-Kandidat ${candidate.position}`}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pending || locked}
                  aria-pressed={candidate.reviewStatus === "APPROVED"}
                  onClick={() => void decide(candidate.candidateId, candidate.reviewRevision, "APPROVED")}
                  className="min-h-11 rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50"
                >
                  Freigeben
                </button>
                <button
                  type="button"
                  disabled={pending || locked}
                  aria-pressed={candidate.reviewStatus === "REJECTED"}
                  onClick={() => void decide(candidate.candidateId, candidate.reviewRevision, "REJECTED")}
                  className="min-h-11 rounded-xl border border-red-400/60 px-3 py-2 font-bold text-red-100 disabled:opacity-50"
                >
                  Ausschließen
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {view.selectionState === "REVIEWING" ? (
        <button
          type="button"
          disabled={pending || view.pendingCount > 0 || allRejected}
          onClick={() => void complete()}
          className="mt-4 min-h-11 rounded-xl bg-fuchsia-600 px-4 py-2 font-bold text-white disabled:opacity-50"
        >
          {view.selectedCount === 0 ? "Ohne Meme fortfahren" : "Auswahl bestätigen / Review abschließen"}
        </button>
      ) : null}
      <p className="mt-3 text-xs text-zinc-400">
        Die gespeicherte Zufallsauswahl und ihre Reihenfolge bleiben unverändert. Ausschlüsse werden nicht nachbesetzt.
      </p>
    </section>
  );
}
