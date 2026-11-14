import { getPauseDurationSeconds, isPauseSlide, type QuizSlideQuestion, type Slide } from "./[quizId]/praesentation/buildPraesentationSlides";
import { createPixelLiveConfigSnapshot } from "./interaction/pixelLiveInteraction";
import { questionTemplateIds, resolveCanonicalQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import type { PresentationTemplateDesign } from "@/app/rendering/templateRegistry";

export function supportsSponsorMoments(style: PresentationTemplateDesign["stylePreset"] | undefined) {
  return style === "EDITORIAL" || style === "KOMM_ONE";
}

export function slideTimerTone(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  if (seconds < 60 || seconds >= 180) return "text-red-400";
  if (seconds < 90 || seconds > 150) return "text-orange-400";
  return "text-green-400";
}

export function timingCategory(slide: Slide<QuizSlideQuestion>): string | null {
  if ((slide.typ === "ablauf" && (
    slide.element.type === "WAITING" || slide.element.type === "START_SEQUENCE" ||
    (slide.element.type === "COUNTDOWN" && slide.element.anchorType === "BEFORE_QUIZ")
  )) || (slide.typ === "fixer-slide" && (
    slide.slideTyp === "vor-dem-start" || slide.slideTyp === "startsequenz"
  ))) return null;
  if (isPauseSlide(slide)) return "pause";
  if (slide.typ === "frage" || slide.typ === "aufloesung") {
    return `${slide.typ}:${slide.frage.templateId ?? "default"}`;
  }
  return "other";
}

export type TimingSamples = Record<string, number[]>;

function fallbackSeconds(slide: Slide<QuizSlideQuestion>) {
  if (slide.typ === "ablauf") return slide.element.config.durationSeconds ?? 20;
  if (slide.typ === "aufloesung") return 30;
  if (slide.typ !== "frage") return 20;
  const { templateId, templateConfig, memeConfig } = slide.frage;
  if (memeConfig?.timerEnabled) return memeConfig.responseDurationSeconds;
  if (templateConfig && resolveCanonicalQuestionTemplateId(templateId) === questionTemplateIds.pixelImage) {
    const pixel = createPixelLiveConfigSnapshot(templateConfig);
    if (pixel.mode === "CHALLENGE") {
      return Object.values(pixel.stageDurationSeconds).reduce((sum, seconds) => sum + seconds, 0);
    }
  }
  return 120;
}

export function estimateRemainingSeconds(slides: readonly Slide<QuizSlideQuestion>[], samples: TimingSamples) {
  return Math.round(slides.reduce((total, slide) => {
    const category = timingCategory(slide);
    if (category === null) return total;
    if (category === "pause") return total + getPauseDurationSeconds(slide);
    const observed = (samples[category] ?? []).filter(value => Number.isFinite(value) && value > 0 && value <= 7200);
    return total + (observed.length ? observed.reduce((sum, value) => sum + value, 0) / observed.length : fallbackSeconds(slide));
  }, 0));
}
