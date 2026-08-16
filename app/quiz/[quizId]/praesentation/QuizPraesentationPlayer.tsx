"use client";

import { useEffect, useMemo, useState } from "react";

import type { QuizPraesentationResult } from "../../actions";
import { getQuizLiveSnapshot, getSchaetzfrageById } from "../../actions";
import type { PixelLiveState } from "@/app/quiz/interaction/pixelLiveInteraction";
import {
  getPraesentationPunktestand,
  getPraesentationStatus,
} from "./statusActions";
import {
  buildPraesentationSlides,
  getPresentationSlideKey,
  isStandingsSlide,
} from "./buildPraesentationSlides";
import PresentationSlideRenderer from "@/app/rendering/presentation/PresentationSlideRenderer";
import {
  resolvePresentationLiveState,
  resolvePresentationSequenceIndex,
  type PresentationLiveState,
} from "@/app/rendering/presentation/presentationLiveState";
import { getPresentationSlideTitle } from "@/app/rendering/presentation/presentationSlideMetadata";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import { QuizThemeScope } from "@/app/rendering/theme/QuizThemeScope";

type Props = {
  quiz: QuizPraesentationResult;
  quizId: number;
  initialLiveState: PresentationLiveState;
  theme: ResolvedQuizTheme;
};

type EstimationQuestion = {
  fragen_id: number;
  frage: string;
  richtigeAntwort: string | null;
};

export default function QuizPraesentationPlayer({
  quiz,
  quizId,
  initialLiveState,
  theme,
}: Props) {
  const slides = useMemo(() => buildPraesentationSlides(quiz), [quiz]);
  const [liveState, setLiveState] = useState(initialLiveState);
  const [scores, setScores] = useState<
    { teamname: string; punkte: number }[]
  >([]);
  const [estimationQuestion, setEstimationQuestion] =
    useState<EstimationQuestion | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [syncError, setSyncError] = useState(false);
  const [pixelState, setPixelState] = useState<PixelLiveState | null>(null);

  const slideIndex = resolvePresentationSequenceIndex(
    liveState,
    slides.map(getPresentationSlideKey),
  ).index;
  const slide = slides[slideIndex];

  useEffect(() => {
    let active = true;
    let refreshing = false;

    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const [storedStatus, interactionSnapshot] = await Promise.all([
          getPraesentationStatus(quizId),
          getQuizLiveSnapshot(quizId),
        ]);
        if (!active) return;

        const nextState = resolvePresentationLiveState(storedStatus);
        setLiveState((current) => {
          if (
            current.updatedAt &&
            nextState.updatedAt &&
            nextState.updatedAt < current.updatedAt
          ) {
            return current;
          }
          return nextState;
        });
        setSyncError(false);
        setPixelState(interactionSnapshot.pixelState);
      } catch {
        if (active) setSyncError(true);
      } finally {
        refreshing = false;
      }
    }

    const interval = window.setInterval(() => void refresh(), 750);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [quizId]);

  useEffect(() => {
    if (!isStandingsSlide(slide)) return;
    let active = true;

    void getPraesentationPunktestand(quizId).then((result) => {
      if (active) setScores(result);
    });

    return () => {
      active = false;
    };
  }, [quizId, slide, liveState.updatedAt]);

  useEffect(() => {
    const questionId = liveState.estimation.questionId;
    if (questionId === null) {
      const timeout = window.setTimeout(() => setEstimationQuestion(null), 0);
      return () => window.clearTimeout(timeout);
    }

    let active = true;
    void getSchaetzfrageById(quizId, questionId).then((question) => {
      if (active) setEstimationQuestion(question);
    });
    return () => {
      active = false;
    };
  }, [liveState.estimation.questionId, quizId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleFullscreen(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["input", "textarea", "select", "audio", "video"].includes(
          target?.tagName.toLowerCase() ?? "",
        )
      ) {
        return;
      }
      if (event.key.toLowerCase() !== "f") return;

      event.preventDefault();
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void document.documentElement.requestFullscreen();
      }
    }

    window.addEventListener("keydown", handleFullscreen);
    return () => window.removeEventListener("keydown", handleFullscreen);
  }, []);

  return (
    <QuizThemeScope
      as="main"
      theme={theme}
      className="presentation-template h-dvh overflow-hidden text-white"
    >
      <div className="h-full p-4">
        <PresentationSlideRenderer
          quiz={quiz}
          slide={slide}
          slides={slides}
          slideIndex={slideIndex}
          slideLabel={getPresentationSlideTitle(slide, slides)}
          theme={theme}
          displayState={{
            renderMode: "PRESENTATION",
            templateRevealCount: liveState.revealCount,
            punktestand: scores,
            endstandRevealCount: liveState.revealCount,
            now,
            estimationPhase: liveState.estimation.phase,
            schaetzfrage: estimationQuestion,
            isSchaetzfrageLoading:
              liveState.estimation.phase !== "HIDDEN" &&
              liveState.estimation.questionId !== null &&
              estimationQuestion === null,
            remoteCountdownDauerSekunden:
              liveState.countdownDurationSeconds,
            remoteCountdownStartedAt: liveState.countdownStartedAt,
            remoteCountdownStatus: liveState.countdownStatus,
            mediaOverlayActive: liveState.mediaOverlayActive,
            playbackCommand: liveState.playbackCommand,
            playbackCommandId: liveState.playbackCommandId,
            pixelState,
          }}
        />
        {syncError && (
          <div
            role="status"
            className="absolute bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-amber-400/60 bg-black/85 px-4 py-2 text-sm font-bold text-amber-100"
          >
            Verbindung unterbrochen – erneuter Abgleich läuft.
          </div>
        )}
      </div>
    </QuizThemeScope>
  );
}
