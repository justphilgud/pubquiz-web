import type { QuizPraesentationResult } from "@/app/quiz/actions";
import type { Slide } from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import { isQuestionSection } from "@/app/quiz/quizSectionPolicy";

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
  if (slide.typ === "aufloesung") return "Auflösung";
  if (slide.typ === "pause") return getSectionDisplayTitle(slide.abschnitt, slides);
  if (slide.typ === "zwischenstand") return "Zwischenstand";
  return "Endstand";
}
