import type { QuizPraesentationResult } from "../../actions";
import {
  isIntroSection,
  isOutroSection,
  isQuestionSection,
} from "../../quizSectionPolicy";

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
  }
  | {
    typ: "aufloesung";
    abschnitt: Abschnitt | null;
    frage: QuizPraesentationResult["fragen"][number];
    frageIndexImBlock: number;
    fragenAnzahlImBlock: number;
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
  quiz: QuizPraesentationResult
): Slide[] {
  const result: Slide[] = [];

  const sortierteAbschnitte = [...quiz.abschnitte].sort(
    (a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0)
  );

  const fragenrunden = sortierteAbschnitte.filter(isQuestionSection);

  for (const abschnitt of sortierteAbschnitte) {
    const fragenImBlock = quiz.fragen
      .filter(
        (frage) =>
          Number(frage.quiz_abschnitt_id) ===
          Number(abschnitt.quiz_abschnitt_id)
      )
      .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0));

    if (isIntroSection(abschnitt)) {
      result.push({ typ: "fixer-slide", slideTyp: "vor-dem-start" });
      result.push({ typ: "fixer-slide", slideTyp: "startsequenz" });
      result.push({ typ: "fixer-slide", slideTyp: "begruessung" });
      result.push({ typ: "fixer-slide", slideTyp: "preise" });
      result.push({ typ: "fixer-slide", slideTyp: "regeln" });
      result.push({ typ: "fixer-slide", slideTyp: "qrcode" });
      continue;
    }

    if (isOutroSection(abschnitt)) {
      result.push({ typ: "fixer-slide", slideTyp: "bekanntmachungen" });
      continue;
    }

    result.push({
      typ: "block",
      abschnitt,
    });

    if (isQuestionSection(abschnitt)) {
      fragenImBlock.forEach((frage, index) => {
        result.push({
          typ: "frage",
          abschnitt,
          frage,
          frageIndexImBlock: index + 1,
          fragenAnzahlImBlock: fragenImBlock.length,
        });
      });

      if (fragenImBlock.length > 0) {
        result.push({
          typ: "pause",
          abschnitt,
          dauerSekunden: abschnitt.dauer_sekunden ?? 300,
        });
      }

      fragenImBlock.forEach((frage, index) => {
        result.push({
          typ: "aufloesung",
          abschnitt,
          frage,
          frageIndexImBlock: index + 1,
          fragenAnzahlImBlock: fragenImBlock.length,
        });
      });

      if (fragenImBlock.length > 0) {
        const istLetzteFragenrunde =
          fragenrunden[fragenrunden.length - 1]?.quiz_abschnitt_id ===
          abschnitt.quiz_abschnitt_id;

        result.push({
          typ: istLetzteFragenrunde ? "endstand" : "zwischenstand",
          abschnitt,
        });
      }

      continue;
    }

    fragenImBlock.forEach((frage, index) => {
      result.push({
        typ: "frage",
        abschnitt,
        frage,
        frageIndexImBlock: index + 1,
        fragenAnzahlImBlock: fragenImBlock.length,
      });
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

  return result;
}
