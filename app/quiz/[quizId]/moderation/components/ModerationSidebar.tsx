"use client";

import type { Slide } from "../../praesentation/buildPraesentationSlides";
import PresentationPreview from "./PresentationPreview";
import ProgressPanel from "./ProgressPanel";
import TeamStatusPanel from "./TeamStatusPanel";
import TimePanel from "./TimePanel";

type AntwortStatus = {
  teamsAngemeldet: number;
  antwortenEingegangen: number;
  prozent: number;
  letzteAntwortAt: string | null;
};

type Props = {
  naechsterSlide: Slide | undefined;
  antwortStatus: AntwortStatus;
  slideStartedAt: string | null;
  quizStartedAt: string | null;
  now: number;
  quizBeendet: boolean;
  slideIndex: number;
  slidesLength: number;
};

export default function ModerationSidebar({
  naechsterSlide,
  antwortStatus,
  slideStartedAt,
  quizStartedAt,
  now,
  quizBeendet,
  slideIndex,
  slidesLength,
}: Props) {
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
      <PresentationPreview slide={naechsterSlide} />

      <TeamStatusPanel antwortStatus={antwortStatus} />

      <TimePanel
        slideStartedAt={slideStartedAt}
        quizStartedAt={quizStartedAt}
        now={now}
        quizBeendet={quizBeendet}
      />

      <ProgressPanel
        slideIndex={slideIndex}
        slidesLength={slidesLength}
        quizStartedAt={quizStartedAt}
        now={now}
      />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-400">
        <div className="mb-1 text-sm font-semibold text-zinc-200">Hotkeys</div>
        ←/→ Slide · Leertaste weiter · PageUp/PageDown · F Vollbild
      </div>
    </aside>
  );
}
