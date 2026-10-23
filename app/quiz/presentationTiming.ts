import { getPauseDurationSeconds, isPauseSlide, type Slide } from "./[quizId]/praesentation/buildPraesentationSlides";

export function slideTimerTone(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  if (seconds < 60 || seconds >= 180) return "text-red-400";
  if (seconds < 90 || seconds > 150) return "text-orange-400";
  return "text-green-400";
}

export function timingCategory(slide: Slide): string | null {
  if ((slide.typ === "ablauf" && slide.element.type === "WAITING") ||
    (slide.typ === "fixer-slide" && slide.slideTyp === "vor-dem-start")) return null;
  if (isPauseSlide(slide)) return "pause";
  if (slide.typ === "frage" || slide.typ === "aufloesung") {
    return `${slide.typ}:${slide.frage.templateId ?? "default"}`;
  }
  return "other";
}

export type TimingSamples = Record<string, number[]>;

export function estimateRemainingSeconds(slides: readonly Slide[], samples: TimingSamples) {
  return Math.round(slides.reduce((total, slide) => {
    const category = timingCategory(slide);
    if (category === null) return total;
    if (category === "pause") return total + getPauseDurationSeconds(slide);
    const observed = (samples[category] ?? []).filter(value => Number.isFinite(value) && value > 0 && value <= 7200);
    const fallback = slide.typ === "frage" ? 120 : slide.typ === "aufloesung" ? 30 : 20;
    return total + (observed.length ? observed.reduce((sum, value) => sum + value, 0) / observed.length : fallback);
  }, 0));
}
