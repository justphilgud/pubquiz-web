"use client";

import type { Slide } from "../../praesentation/buildPraesentationSlides";
import SlidePreview, { getSlideTitel } from "./SlidePreview";

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
  preiseText?: string | null;
};

export default function CurrentSlidePanel({
  slideIndex,
  slides,
  aktuellerSlide,
  countdownRestSekunden,
  punktestand,
  endstandRevealCount,
  preiseText,
}: Props) {
  const titel =
    aktuellerSlide?.typ === "frage"
      ? "Frage"
      : aktuellerSlide?.typ === "aufloesung"
        ? "Auflösung"
        : getSlideTitel(aktuellerSlide, slides);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-3 text-sm text-zinc-400">
        Aktueller Slide {slideIndex + 1} / {slides.length}
      </div>

      <h1 className="text-3xl font-bold">{titel}</h1>

      <div className="mt-6 min-h-[420px] rounded-xl border border-zinc-800 bg-black p-8 text-zinc-100">
        <SlidePreview
          slide={aktuellerSlide}
          slides={slides}
          countdownRestSekunden={countdownRestSekunden}
          punktestand={punktestand}
          endstandRevealCount={endstandRevealCount}
          preiseText={preiseText}
        />
      </div>
    </div>
  );
}
