import type { QuizPraesentationResult } from "@/app/quiz/actions";
import type { Slide } from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import { isQuestionSection } from "@/app/quiz/quizSectionPolicy";
import { getQuizFlowTypeLabel } from "@/app/quiz/flow/quizFlow";
import { questionPhaseMedia } from "./questionPhaseMedia";
import { pixelRuntimeStageToMediaSlot } from "@/app/quiz/interaction/pixelLiveInteraction";

export function getSlideSpeech(slide: Slide | undefined) {
  if (slide?.typ !== "frage") return null;
  const data = slide.frage.templateConfig?.templateData;
  return data?.kind === "TRANSLATION_READ_ALOUD" ? data : null;
}

export function getPresentationSlideMedia(slide: Slide | undefined, pixelStage = 1) {
  if (slide?.typ === "frage") {
    const media = questionPhaseMedia(slide.frage.templateId, slide.frage.medien, "QUESTION");
    if (slide.frage.templateId !== "pixelbild") return media;
    const images = media.filter(item => /\.(jpe?g|png|gif|webp|svg)(?:[?#].*)?$/i.test(item.datei))
      .sort((left, right) => left.sortierung - right.sortierung);
    const keyed = images.filter(item => item.slotKey?.startsWith("pixel_stage_"));
    const stages = keyed.length ? keyed : images.slice(-3);
    const slot = pixelRuntimeStageToMediaSlot(Math.min(3, Math.max(1, pixelStage)) as 1 | 2 | 3);
    const selected = keyed.length ? keyed.find(item => item.slotKey === slot) : stages[pixelStage - 1];
    return selected ? [selected] : [];
  }
  return slide?.typ === "aufloesung" ? [
    ...questionPhaseMedia(slide.frage.templateId, slide.frage.medien, "SOLUTION"),
    ...slide.frage.antworten.flatMap(answer => answer.medien),
  ] : [];
}

export function isIntroMusicSlide(slide: Slide | undefined) {
  return (slide?.typ === "fixer-slide" && slide.slideTyp === "startsequenz") ||
    (slide?.typ === "ablauf" && slide.element.type === "START_SEQUENCE");
}

function getSectionDisplayTitle(
  section: QuizPraesentationResult["abschnitte"][number] | null | undefined,
  slides: Slide[],
) {
  if (!section) return "Kein Block";
  if (!isQuestionSection(section)) return section.titel;

  const blockIndex = slides
    .filter(
      (slide) =>
        slide.typ === "block" && isQuestionSection(slide.abschnitt),
    )
    .findIndex(
      (slide) =>
        slide.typ === "block" &&
        slide.abschnitt.quiz_abschnitt_id === section.quiz_abschnitt_id,
    );

  return blockIndex >= 0 ? `Block ${blockIndex + 1}` : section.titel;
}

export function getPresentationSlideTitle(
  slide: Slide | undefined,
  slides: Slide[],
) {
  if (!slide) return "Kein Slide";
  if (slide.typ === "pixel-erklaerung") return "Pixelbild · Spielregeln";
  if (slide.typ === "meme-erklaerung") return "Meme-Runde · Erklärung";

  if (slide.typ === "ablauf") {
    return slide.element.label ?? getQuizFlowTypeLabel(slide.element.type);
  }

  if (slide.typ === "fixer-slide") {
    const titles = {
      "vor-dem-start": "Vor dem Start",
      startsequenz: "Startsequenz",
      begruessung: "Begrüßung",
      preise: "Preise",
      regeln: "Regeln",
      qrcode: "QR-Code",
      bekanntmachungen: "Bekanntmachungen",
    } as const;
    return titles[slide.slideTyp];
  }

  if (slide.typ === "block") {
    return getSectionDisplayTitle(slide.abschnitt, slides);
  }
  if (slide.typ === "frage") return "Frage";
  if (slide.typ === "funny") return "Falsch aber lustig";
  if (slide.typ === "aufloesung") return "Auflösung";
  if (slide.typ === "pause") return getSectionDisplayTitle(slide.abschnitt, slides);
  if (slide.typ === "zwischenstand") return "Zwischenstand";
  return "Endstand";
}
