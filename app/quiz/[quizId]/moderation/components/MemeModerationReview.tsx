"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

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

export type MemeModerationReviewHandle = {
  preparePresentation: () => Promise<
    | { ready: true; selectionId: number }
    | { ready: false; skipped: boolean }
  >;
};

const statusLabel = {
  PENDING_REVIEW: "Offen",
  APPROVED: "Freigegeben",
  REJECTED: "Ausgeschlossen",
} as const;

const MemeModerationReview = forwardRef<MemeModerationReviewHandle, Props>(function MemeModerationReview({
  quizId,
  quizFragenId,
  imageUrl,
}: Props, ref) {
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
    if (view?.phase !== "REVIEW") return null;
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
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Der Review konnte nicht abgeschlossen werden.");
      return null;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  useImperativeHandle(ref, () => ({
    async preparePresentation() {
      if (view?.phase !== "REVIEW") return { ready: false, skipped: false };
      if (view.selectionState === "COMPLETED") {
        return { ready: true, selectionId: view.selectionId };
      }
      if (view.selectionState === "SKIPPED") {
        return { ready: false, skipped: true };
      }
      if (view.answerPhaseOpen) {
        setMessage("Schließe zuerst die Antwortphase. Bereits finale Memes können bis dahin weiter geprüft werden.");
        return { ready: false, skipped: false };
      }
      const result = await complete();
      if (result?.success && result.view.phase === "REVIEW" && result.view.selectionState === "COMPLETED") {
        return { ready: true, selectionId: result.view.selectionId };
      }
      return {
        ready: false,
        skipped: Boolean(
          result?.success &&
          result.view.phase === "REVIEW" &&
          result.view.selectionState === "SKIPPED",
        ),
      };
    },
  }));

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
          Die Vorabmoderation erscheint, sobald das erste Team sein Meme final abgegeben hat.
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
      data-answer-phase-open={view.answerPhaseOpen ? "true" : "false"}
      className="rounded-2xl border border-fuchsia-500/50 bg-fuchsia-950/30 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Meme-Auswahl &amp; Review</h2>
          <p className="mt-1 text-sm text-zinc-300">
            {view.selectedCount} eingereicht · {view.approvedCount} freigegeben ·{" "}
            {view.rejectedCount} ausgeschlossen · {view.pendingCount} offen
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {view.validSubmissionCount} gültige finale Einreichungen ·{" "}
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {view.candidates.map((candidate) => (
            <article
              key={candidate.candidateId}
              className="rounded-xl border border-zinc-700 bg-zinc-950/45 p-2.5"
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
                className="mx-auto max-w-[20rem] rounded-xl"
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
          disabled={pending || view.answerPhaseOpen || view.pendingCount > 0 || allRejected}
          onClick={() => void complete()}
          className="mt-4 min-h-11 rounded-xl bg-fuchsia-600 px-4 py-2 font-bold text-white disabled:opacity-50"
        >
          {view.answerPhaseOpen
            ? "Antwortphase läuft"
            : view.selectedCount === 0
              ? "Ohne Meme fortfahren"
              : "Auswahl bestätigen / Review abschließen"}
        </button>
      ) : null}
      <p className="mt-3 text-xs text-zinc-400">
        Während der Eingabe bleibt die Prüfung anonym. Nach dem Schließen wird die freigegebene Auswahl einmal zufällig sortiert und persistent gespeichert; Ausschlüsse werden nicht nachbesetzt.
      </p>
    </section>
  );
});

export default MemeModerationReview;
