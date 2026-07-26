"use client";

import type { QuizPraesentationResult } from "../../../actions";
import type { Slide } from "../../praesentation/buildPraesentationSlides";
import PresentationSlideRenderer from "@/app/rendering/presentation/PresentationSlideRenderer";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import { getPresentationSlideTitle } from "@/app/rendering/presentation/presentationSlideMetadata";
import type { PresentationPlaybackCommand } from "@/app/rendering/presentation/presentationLiveState";

type PunktestandEintrag = {
  teamname: string;
  punkte: number;
};

type Props = {
  slideIndex: number;
  slides: Slide[];
  aktuellerSlide: Slide | undefined;
  countdownRestSekunden: number;
  punktestand: PunktestandEintrag[];
  endstandRevealCount: number;
  quiz: QuizPraesentationResult;
  theme: ResolvedQuizTheme;
  mediaOverlayActive: boolean;
  playbackCommand: PresentationPlaybackCommand;
  playbackCommandId: number;
  estimationPhase: "HIDDEN" | "RUNNING" | "SOLUTION";
  estimationQuestion: {
    fragen_id: number;
    frage: string;
    richtigeAntwort: string | null;
  } | null;
};

export default function CurrentSlidePanel({
  slideIndex,
  slides,
  aktuellerSlide,
  countdownRestSekunden,
  punktestand,
  endstandRevealCount,
  quiz,
  theme,
  mediaOverlayActive,
  playbackCommand,
  playbackCommandId,
  estimationPhase,
  estimationQuestion,
}: Props) {
  const titel =
    aktuellerSlide?.typ === "frage"
      ? "Frage"
      : aktuellerSlide?.typ === "aufloesung"
        ? "Auflösung"
        : getPresentationSlideTitle(aktuellerSlide, slides);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-3 text-sm text-zinc-400">
        Aktueller Slide {slideIndex + 1} / {slides.length}
      </div>

      <h1 className="text-3xl font-bold">{titel}</h1>

      <div className="mt-6 h-[min(58vh,620px)] min-h-[420px] overflow-hidden rounded-xl border border-zinc-800 bg-black p-3 text-zinc-100">
        <PresentationSlideRenderer
          quiz={quiz}
          slide={aktuellerSlide}
          slides={slides}
          slideIndex={slideIndex}
          slideLabel={getPresentationSlideTitle(aktuellerSlide, slides)}
          theme={theme}
          displayState={{
            renderMode: "MODERATION_PREVIEW",
            templateRevealCount: endstandRevealCount,
            punktestand,
            endstandRevealCount,
            now: 0,
            estimationPhase,
            schaetzfrage: estimationQuestion,
            isSchaetzfrageLoading: false,
            remoteCountdownDauerSekunden: countdownRestSekunden,
            remoteCountdownStartedAt: null,
            remoteCountdownStatus: "idle",
            mediaOverlayActive,
            playbackCommand,
            playbackCommandId,
          }}
        />
      </div>
    </div>
  );
}
