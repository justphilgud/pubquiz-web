"use client";

import { useEffect, useRef, useState } from "react";
import { estimateRemainingSeconds, timingCategory, type TimingSamples } from "@/app/quiz/presentationTiming";
import { getPresentationSlideKey, type Slide } from "../../praesentation/buildPraesentationSlides";

function formatSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(rest).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

type Props = {
  slideIndex: number;
  slides: Slide[];
  quizId: number;
  slideStartedAt: string | null;
  quizStartedAt: string | null;
  now: number;
};

export default function ProgressPanel({
  slideIndex,
  slides,
  quizId,
  slideStartedAt,
  quizStartedAt,
  now,
}: Props) {
  const [samples, setSamples] = useState<{ key: string | null; values: TimingSamples }>({ key: null, values: {} });
  const previous = useRef<{ key: string; category: string | null; started: number; index: number } | null>(null);
  const storageKey = `quiz-timing-${quizId}-${quizStartedAt ?? "pending"}`;
  useEffect(() => {
    const loaded: TimingSamples = {};
    previous.current = null;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        for (const [category, values] of Object.entries(stored)) {
          if (Array.isArray(values)) loaded[category] = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 7200).slice(-20);
        }
      }
    } catch { /* An unavailable browser store must not stop moderation. */ }
    // This effect synchronizes an external browser store when the quiz session changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSamples({ key: storageKey, values: loaded });
  }, [storageKey]);
  const slide = slides[slideIndex];
  useEffect(() => {
    if (!slide || !slideStartedAt || !quizStartedAt) return;
    const started = Date.parse(slideStartedAt);
    if (!Number.isFinite(started) || started < Date.parse(quizStartedAt)) return;
    const key = getPresentationSlideKey(slide);
    const last = previous.current;
    if (last && last.key !== key && slideIndex === last.index + 1 && last.category && last.category !== "pause") {
      const seconds = (started - last.started) / 1000;
      if (seconds > 0 && seconds <= 7200) {
        const category = last.category;
        // Server slide transitions are the external observation source, not a second clock.
        setSamples(current => {
          const values = current.key === storageKey ? current.values : {};
          return { key: storageKey, values: { ...values, [category]: [...(values[category] ?? []), seconds].slice(-20) } };
        });
      }
    }
    previous.current = { key, category: timingCategory(slide), started, index: slideIndex };
  }, [slide, slideIndex, slideStartedAt, quizStartedAt, storageKey]);
  useEffect(() => {
    try { if (samples.key === storageKey && Object.keys(samples.values).length) localStorage.setItem(storageKey, JSON.stringify(samples.values)); } catch { /* Optional local history. */ }
  }, [samples, storageKey]);
  const slidesLength = slides.length;
  const currentSlideNumber = slidesLength === 0 ? 0 : slideIndex + 1;
  const remainingSlides = Math.max(0, slidesLength - currentSlideNumber);
  const progressPercent = slidesLength > 0 ? Math.round(currentSlideNumber / slidesLength * 100) : 0;
  const estimatedRemainingSeconds = quizStartedAt ? estimateRemainingSeconds(slides.slice(slideIndex + 1), samples.key === storageKey ? samples.values : {}) : null;

  const estimatedEndAt =
    estimatedRemainingSeconds !== null
      ? new Date(now + estimatedRemainingSeconds * 1000)
      : null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fortschritt</h2>
        <div className="text-xl font-black text-cyan-300">
          {progressPercent}%
        </div>
      </div>

      <div className="mb-3 h-3 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-cyan-400 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">
            {currentSlideNumber} / {slidesLength}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Slides</div>
        </div>

        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">{remainingSlides}</div>
          <div className="mt-1 text-xs text-zinc-400">verbleibend</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black" suppressHydrationWarning>
            {formatSeconds(estimatedRemainingSeconds)}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Prognose Rest</div>
        </div>

        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black" suppressHydrationWarning>
            {estimatedEndAt
              ? estimatedEndAt.toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Prognose Ende</div>
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">Schätzung nach Fragetyp und Phase; lokale Beobachtungen, sonst 2:00 pro Frage, 0:30 pro Lösung und 0:20 pro weiterer Folie. Pausen gemäß Konfiguration. Wartebildschirm ausgenommen.</p>
      {!quizStartedAt && (
        <div className="mt-4 text-sm text-zinc-500">
          Prognose startet, sobald das Quiz gestartet wurde.
        </div>
      )}
    </div>
  );
}
