"use client";

import { useEffect, useRef, useState } from "react";
import type { QuizPraesentationResult } from "../../../actions";
import type { Slide } from "../../praesentation/buildPraesentationSlides";
import PresentationSlideRenderer from "@/app/rendering/presentation/PresentationSlideRenderer";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import { getPresentationSlideTitle } from "@/app/rendering/presentation/presentationSlideMetadata";
import type { PresentationPlaybackCommand } from "@/app/rendering/presentation/presentationLiveState";
import {
  MODERATION_PREVIEW_LOGICAL_HEIGHT,
  MODERATION_PREVIEW_LOGICAL_WIDTH,
  resolveModerationPreviewLayout,
} from "../moderationPreviewLayout";
import type { PixelLiveState } from "@/app/quiz/interaction/pixelLiveInteraction";
import type { PollLiveState } from "@/app/quiz/interaction/pollInteraction";
import type { TeamAvatarCode } from "@/app/teams/teamProfile";
import type { FunnyAnswerEntry } from "@/app/quiz/funnyAnswerReveal";
import type { YearlyRankingEntry } from "@/app/quiz/yearlyRanking";
import { resolveIntermediateStandingsAudience } from "@/app/rendering/presentation/presentationRankingPolicy";

type PunktestandEintrag = {
  teamId: number;
  teamname: string;
  punkte: number;
  avatarCode: TeamAvatarCode;
  photoUrl: string | null;
};

type Props = {
  slideIndex: number;
  slides: Slide[];
  aktuellerSlide: Slide | undefined;
  countdownRestSekunden: number;
  punktestand: PunktestandEintrag[];
  yearlyStandings: YearlyRankingEntry[];
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
  now: number;
  pixelState: PixelLiveState | null;
  pollState: PollLiveState | null;
  teamJoinState: {
    teams: {
      teamId: number;
      teamName: string;
      avatarCode: TeamAvatarCode;
      photoUrl: string | null;
    }[];
    totalTeams: number;
    remainingTeams: number;
  } | null;
  funnyAnswers: FunnyAnswerEntry[];
};

export default function CurrentSlidePanel({
  slideIndex,
  slides,
  aktuellerSlide,
  countdownRestSekunden,
  punktestand,
  yearlyStandings,
  endstandRevealCount,
  quiz,
  theme,
  mediaOverlayActive,
  playbackCommand,
  playbackCommandId,
  estimationPhase,
  estimationQuestion,
  now,
  pixelState,
  pollState,
  teamJoinState,
  funnyAnswers,
}: Props) {
  const titel =
    aktuellerSlide?.typ === "frage"
      ? "Frage"
      : aktuellerSlide?.typ === "aufloesung"
        ? "Auflösung"
        : getPresentationSlideTitle(aktuellerSlide, slides);
  const previewHostRef = useRef<HTMLDivElement>(null);
  const [previewLayout, setPreviewLayout] = useState(() =>
    resolveModerationPreviewLayout(0, 0),
  );

  useEffect(() => {
    const previewHost = previewHostRef.current;
    if (!previewHost) return;

    const updatePreviewLayout = () => {
      setPreviewLayout(
        resolveModerationPreviewLayout(
          previewHost.clientWidth,
          window.innerHeight,
        ),
      );
    };

    const resizeObserver = new ResizeObserver(updatePreviewLayout);
    resizeObserver.observe(previewHost);
    window.addEventListener("resize", updatePreviewLayout);
    updatePreviewLayout();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePreviewLayout);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <div className="mb-3 text-sm text-zinc-400">
        Aktueller Slide {slideIndex + 1} / {slides.length}
      </div>

      <h1 className="text-2xl font-bold">{titel}</h1>

      <div
        ref={previewHostRef}
        className="mt-4 flex w-full justify-center"
        data-testid="moderation-preview-host"
      >
        <div
          aria-label="Präsentationsvorschau"
          className="overflow-hidden rounded-xl border border-zinc-800 bg-black text-zinc-100"
          data-testid="moderation-preview-viewport"
          style={{
            width: previewLayout.width,
            height: previewLayout.height,
          }}
        >
          <div
            style={{
              width: MODERATION_PREVIEW_LOGICAL_WIDTH,
              height: MODERATION_PREVIEW_LOGICAL_HEIGHT,
              transform: `scale(${previewLayout.scale})`,
              transformOrigin: "top left",
            }}
          >
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
                intermediateStandings: resolveIntermediateStandingsAudience(
                  punktestand,
                  "MODERATION_PREVIEW",
                ),
                yearlyStandings,
                endstandRevealCount,
                now,
                estimationPhase,
                schaetzfrage: estimationQuestion,
                isSchaetzfrageLoading: false,
                remoteCountdownDauerSekunden: countdownRestSekunden,
                remoteCountdownStartedAt: null,
                remoteCountdownStatus: "idle",
                mediaOverlayActive,
                playbackCommand,
                playbackCommandId,
                pixelState,
                pollState,
                teamJoinState,
                funnyAnswers,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
