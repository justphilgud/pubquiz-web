import type { QuizPraesentationResult } from "../../actions";
import {
  isIntroSection,
  isOutroSection,
  isQuestionSection,
} from "../../quizSectionPolicy";
import {
  resolveQuizFlow,
  type QuizFlowItem,
  type QuizFlowItemType,
} from "../../flow/quizFlow";
import { resolveQuizBlockSequence } from "../../flow/quizBlockSequence";

export type Medium = {
  medien_id: number;
  datei: string;
  medientyp: string;
  sortierung: number;
  bemerkung: string | null;
};


export type PraesentationQuiz = QuizPraesentationResult & {
  intro_startzeit?: string | null;
  intro_video_url?: string | null;
  intro_logo_url?: string | null;
  intro_wartetext?: string | null;
  intro_musik_url?: string | null;
  intro_startsequenz_text?: string | null;
  outro_bekanntmachungen?: string | null;
  outro_musik_url?: string | null;
};

export type Abschnitt = QuizPraesentationResult["abschnitte"][number];

export type FixerSlideTyp =
  | "vor-dem-start"
  | "startsequenz"
  | "begruessung"
  | "preise"
  | "regeln"
  | "qrcode"
  | "bekanntmachungen";

export type Slide =
  | {
    typ: "ablauf";
    element: QuizFlowItem;
    abschnitt: Abschnitt | null;
  }
  | {
    typ: "fixer-slide";
    slideTyp: FixerSlideTyp;
  }
  | {
    typ: "block";
    abschnitt: Abschnitt;
  }
  | {
    typ: "frage";
    abschnitt: Abschnitt | null;
    frage: QuizPraesentationResult["fragen"][number];
    frageIndexImBlock: number;
    fragenAnzahlImBlock: number;
    blockItem?: QuizFlowItem | null;
    solutionStrategy?: import("../../flow/quizFlow").QuizSolutionStrategy;
  }
  | {
    typ: "aufloesung";
    abschnitt: Abschnitt | null;
    frage: QuizPraesentationResult["fragen"][number];
    frageIndexImBlock: number;
    fragenAnzahlImBlock: number;
    blockItem?: QuizFlowItem | null;
    solutionStrategy?: import("../../flow/quizFlow").QuizSolutionStrategy;
  }
  | {
    typ: "pause";
    abschnitt: Abschnitt;
    dauerSekunden: number;
  }
  | {
    typ: "zwischenstand";
    abschnitt: Abschnitt;
  }
  | {
    typ: "endstand";
    abschnitt: Abschnitt;
  };

export function buildPraesentationSlides(
  quiz: QuizPraesentationResult,
  options: { includeDisabledFlowItems?: boolean } = {},
): Slide[] {
  const result: Slide[] = [];

  const sortierteAbschnitte = [...quiz.abschnitte].sort(
    (a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0)
  );

  const flow = resolveQuizFlow(quiz, quiz.ablaufElemente).filter(
    (item) => options.includeDisabledFlowItems || item.enabled,
  );

  const appendFlowItems = (
    anchorType: QuizFlowItem["anchorType"],
    anchorKey: string,
    abschnitt: Abschnitt | null,
  ) => {
    flow
      .filter(
        (item) =>
          item.anchorType === anchorType && item.anchorKey === anchorKey,
      )
      .sort((left, right) => left.order - right.order)
      .forEach((element) => result.push({ typ: "ablauf", element, abschnitt }));
  };

  appendFlowItems("BEFORE_QUIZ", "QUIZ", null);
  if (options.includeDisabledFlowItems) {
    appendFlowItems("BEFORE_QUIZ", "UNASSIGNED", null);
  }

  for (const abschnitt of sortierteAbschnitte) {
    const fragenImBlock = quiz.fragen
      .filter(
        (frage) =>
          Number(frage.quiz_abschnitt_id) ===
          Number(abschnitt.quiz_abschnitt_id)
      )
      .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0));

    if (isIntroSection(abschnitt) || isOutroSection(abschnitt)) continue;

    if (isQuestionSection(abschnitt)) {
      appendFlowItems(
        "ROUND_START",
        String(abschnitt.quiz_abschnitt_id),
        abschnitt,
      );

      const blockSequence = resolveQuizBlockSequence({
        sectionId: abschnitt.quiz_abschnitt_id,
        quizStrategy: quiz.aufloesungsstrategie,
        sectionStrategy: abschnitt.aufloesungsstrategie,
        questions: fragenImBlock,
        blockItems: flow,
        includeDisabledItems: options.includeDisabledFlowItems,
      });
      const questionIndexById = new Map(
        fragenImBlock.map((frage, index) => [frage.quiz_fragen_id, index + 1]),
      );
      for (const entry of blockSequence.entries) {
        if (entry.kind === "CONTENT") {
          result.push({ typ: "ablauf", element: entry.item, abschnitt });
          continue;
        }
        const shared = {
          abschnitt,
          frage: entry.question,
          frageIndexImBlock:
            questionIndexById.get(entry.question.quiz_fragen_id) ?? 1,
          fragenAnzahlImBlock: fragenImBlock.length,
          blockItem: entry.item,
          solutionStrategy: blockSequence.strategy,
        };
        result.push(
          entry.kind === "QUESTION"
            ? { typ: "frage", ...shared }
            : { typ: "aufloesung", ...shared },
        );
      }

      appendFlowItems(
        "ROUND_END",
        String(abschnitt.quiz_abschnitt_id),
        abschnitt,
      );
      continue;
    }

    result.push({
      typ: "block",
      abschnitt,
    });

    fragenImBlock.forEach((frage, index) => {
      const shared = {
        abschnitt,
        frage,
        frageIndexImBlock: index + 1,
        fragenAnzahlImBlock: fragenImBlock.length,
      };
      result.push({ typ: "frage", ...shared });
      result.push({ typ: "aufloesung", ...shared });
    });
  }

  const fragenOhneBlock = quiz.fragen
    .filter((frage) => frage.quiz_abschnitt_id == null)
    .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0));

  if (fragenOhneBlock.length > 0) {
    fragenOhneBlock.forEach((frage, index) => {
      result.push({
        typ: "frage",
        abschnitt: null,
        frage,
        frageIndexImBlock: index + 1,
        fragenAnzahlImBlock: fragenOhneBlock.length,
      });

      result.push({
        typ: "aufloesung",
        abschnitt: null,
        frage,
        frageIndexImBlock: index + 1,
        fragenAnzahlImBlock: fragenOhneBlock.length,
      });
    });
  }

  appendFlowItems("AFTER_QUIZ", "QUIZ", null);

  return result;
}

export function getPresentationSlideKey(slide: Slide) {
  if (slide.typ === "ablauf") {
    if (
      slide.element.anchorType === "BLOCK" &&
      slide.element.persistentId !== null
    ) {
      return slide.element.storyElementRevisionId
        ? `story-placement:${slide.element.persistentId}`
        : `block-item:${slide.element.persistentId}`;
    }
    return `${slide.element.id}:${slide.element.type}`;
  }
  if (slide.typ === "fixer-slide") return `fixed:${slide.slideTyp}`;
  if (slide.typ === "block") {
    return `section:${slide.abschnitt.quiz_abschnitt_id}:intro`;
  }
  if (slide.typ === "frage") {
    return `question:${slide.frage.quiz_fragen_id}:question`;
  }
  if (slide.typ === "aufloesung") {
    return `question:${slide.frage.quiz_fragen_id}:solution`;
  }
  if (slide.typ === "pause") {
    return `section:${slide.abschnitt.quiz_abschnitt_id}:break`;
  }
  if (slide.typ === "zwischenstand") {
    return `section:${slide.abschnitt.quiz_abschnitt_id}:standings`;
  }
  return `section:${slide.abschnitt.quiz_abschnitt_id}:final`;
}

export function getSlideFlowType(slide: Slide | undefined): QuizFlowItemType | null {
  return slide?.typ === "ablauf" ? slide.element.type : null;
}

export function isPauseSlide(slide: Slide | undefined) {
  return (
    slide?.typ === "pause" ||
    (slide?.typ === "ablauf" &&
      (slide.element.type === "BREAK" || slide.element.type === "COUNTDOWN"))
  );
}

export function getPauseDurationSeconds(slide: Slide | undefined) {
  if (slide?.typ === "pause") return slide.dauerSekunden;
  if (isPauseSlide(slide) && slide?.typ === "ablauf") {
    return slide.element.config.durationSeconds ?? 300;
  }
  return 0;
}

export function isStandingsSlide(slide: Slide | undefined) {
  return (
    slide?.typ === "zwischenstand" ||
    slide?.typ === "endstand" ||
    (slide?.typ === "ablauf" &&
      ["INTERMEDIATE_STANDINGS", "FINAL_STANDINGS", "WINNER"].includes(
        slide.element.type,
      ))
  );
}

export function isFinalStandingsSlide(slide: Slide | undefined) {
  return (
    slide?.typ === "endstand" ||
    (slide?.typ === "ablauf" && slide.element.type === "FINAL_STANDINGS")
  );
}

export function getSlideModeratorNote(slide: Slide | undefined) {
  return slide?.typ === "ablauf"
    ? (slide.element.config.moderatorNote ?? null)
    : null;
}
