"use client";

import { useMemo } from "react";

import type { QuizPraesentationResult } from "@/app/quiz/actions";
import type { Slide } from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import PresentationSlideRenderer, {
  type PresentationSlideDisplayState,
} from "@/app/rendering/presentation/PresentationSlideRenderer";
import { resolvePresentationLayout } from "@/app/rendering/presentation/presentationLayoutResolver";
import { resolveQuizTheme } from "@/app/rendering/theme/quizTheme";
import { QuizThemeScope } from "@/app/rendering/theme/QuizThemeScope";
import {
  toRuntimeAnswerFormTemplate,
  toRuntimePresentationTemplate,
  type PresentationTemplateConfig,
} from "./presentationTemplate";

export const presentationPreviewScenarios = [
  ["TEXT", "Standardfrage"],
  ["IMAGE", "Bildfrage"],
  ["MULTIPLE_CHOICE", "Multiple Choice"],
  ["TRUE_FALSE", "Wahr/Falsch"],
  ["AUDIO", "Audiofrage"],
  ["ORDERING", "Reihenfolge"],
  ["PIXEL", "Pixelbild / Reveal"],
  ["SOLUTION", "Auflösung"],
  ["MODERATION", "Moderation"],
  ["ANSWER_FORM", "Antwortformular"],
  ["BIRTHDAY_IMAGE", "Geburtstag · persönliches Bild"],
  ["BIRTHDAY_SOLUTION", "Geburtstag · Auflösung"],
  ["BIRTHDAY_FALLBACK", "Geburtstag · ohne Bilder"],
  ["CORPORATE_LOGO", "Corporate · Logo"],
  ["CORPORATE_MEDIA", "Corporate · Medienfrage"],
  ["CORPORATE_SOLUTION", "Corporate · Auflösung"],
] as const;

export type PresentationPreviewScenario =
  (typeof presentationPreviewScenarios)[number][0];

type Props = {
  config: PresentationTemplateConfig;
  templateId: string;
  templateName: string;
  scenario: PresentationPreviewScenario;
};

function questionForScenario(scenario: PresentationPreviewScenario) {
  const templateId =
    scenario === "MULTIPLE_CHOICE"
      ? "multiple_choice"
      : scenario === "TRUE_FALSE"
        ? "wahr_falsch"
        : scenario === "AUDIO"
          ? "musik_rueckwaerts"
          : scenario === "ORDERING"
            ? "reihenfolge"
            : scenario === "PIXEL"
              ? "pixelbild"
              : null;
  const answers =
    scenario === "TRUE_FALSE"
      ? ["Wahr", "Falsch"]
      : scenario === "ORDERING"
        ? ["Frühling", "Sommer", "Herbst", "Winter"]
        : ["Berlin", "Hamburg", "München", "Köln"];
  const media =
    scenario === "IMAGE" || scenario === "PIXEL" || scenario === "BIRTHDAY_IMAGE" || scenario === "CORPORATE_MEDIA"
      ? [{ fileName: "template-preview.svg", mediaType: "Bild", scope: "QUESTION" as const }]
      : scenario === "AUDIO"
        ? [{ fileName: "vorschau.mp3", mediaType: "Audio", scope: "QUESTION" as const }]
        : [];
  const layoutInput = {
    templateId,
    questionText: "Welche Hauptstadt gehört zu Deutschland?",
    answerOptionCount: answers.length,
    structuredFieldCount: 0,
    media,
  };

  return {
    quiz_fragen_id: 1,
    quiz_abschnitt_id: 1,
    sortierung: 1,
    fragen_id: 1,
    frage:
      scenario === "AUDIO"
        ? "Welcher Song ist in diesem rückwärts abgespielten Ausschnitt zu hören?"
        : scenario === "ORDERING"
          ? "Bringt diese Jahreszeiten in die richtige Reihenfolge."
          : "Welche Hauptstadt gehört zu Deutschland?",
    templateId,
    templateConfig: null,
    punkte_modus: "standard",
    freie_antwort_erlaubt: false,
    urspruenglicher_antwortmodus: "CLOSED" as const,
    effektiver_antwortmodus: "CLOSED" as const,
    quelle: "Vorschauinhalt",
    kategorien: ["Beispiel"],
    praesentationslayout: "standard",
    presentationLayouts: {
      question: resolvePresentationLayout({ ...layoutInput, phase: "QUESTION" }),
      solution: resolvePresentationLayout({ ...layoutInput, phase: "SOLUTION" }),
    },
    antwort_reihenfolge: answers.map((_, index) => index + 1),
    medien: media.map((medium, index) => ({
      medien_id: index + 1,
      datei: medium.fileName,
      medientyp: medium.mediaType,
      sortierung: index,
      bemerkung: null,
    })),
    antwortfelder: [],
    antworten: answers.map((answer, index) => ({
      antwort_id: index + 1,
      antwort: answer,
      ist_richtig: index === 0,
      antworttyp: "Text",
      medien: [],
    })),
    bildMedien: [],
  } satisfies QuizPraesentationResult["fragen"][number];
}

function buildPreviewQuiz(scenario: PresentationPreviewScenario): QuizPraesentationResult {
  return {
    quiz_id: 0,
    intro_begruessungstitel: "Willkommen zum Quiz",
    intro_begruessungstext: "Eine Vorschau mit realistischen Beispielinhalten.",
    intro_regeln: "Fair spielen · Gemeinsam rätseln · Spaß haben",
    intro_preise: "Ruhm, Ehre und ein großartiger Abend",
    intro_logo_url: null,
    intro_musik_url: null,
    intro_wartetext: null,
    intro_video_url: null,
    intro_startzeit: null,
    outro_bekanntmachungen: "Danke fürs Mitspielen!",
    outro_musik_url: null,
    titel: "Designvorschau",
    quiz_datum: "2026-07-31",
    abschnitte: [{
      quiz_abschnitt_id: 1,
      titel: "Runde 1 · Bunt gemischt",
      abschnitt_typ: "FRAGEN",
      sortierung: 1,
      dauer_sekunden: 300,
      qr_code_url: null,
      medien_datei: null,
      bemerkung: null,
    }],
    fragen: [questionForScenario(scenario)],
  };
}

const displayState: PresentationSlideDisplayState = {
  renderMode: "DESIGN_PREVIEW",
  templateRevealCount: 4,
  punktestand: [
    { teamname: "Die Ratlosen", punkte: 21 },
    { teamname: "Quiztopher Columbus", punkte: 19.5 },
    { teamname: "Vier gewinnt", punkte: 18 },
  ],
  endstandRevealCount: 3,
  now: Date.UTC(2026, 6, 31, 20),
  estimationPhase: "HIDDEN",
  schaetzfrage: null,
  isSchaetzfrageLoading: false,
  remoteCountdownDauerSekunden: null,
  remoteCountdownStartedAt: null,
  remoteCountdownStatus: null,
  mediaOverlayActive: false,
  playbackCommand: null,
  playbackCommandId: 0,
};

export function PresentationTemplatePreview({
  config,
  templateId,
  templateName,
  scenario,
}: Props) {
  const theme = useMemo(() => {
    const effectiveConfig = structuredClone(config);
    if (scenario === "BIRTHDAY_FALLBACK") {
      effectiveConfig.design.imagery.heroImage = null;
      effectiveConfig.design.imagery.personalImagePool = [];
    }
    const managed = { id: templateId, name: templateName, config: effectiveConfig };
    return resolveQuizTheme({
      displayName: templateName,
      presentation: {
        template: toRuntimePresentationTemplate(managed),
        source: "QUIZ",
        requestedId: templateId,
        usedFallback: false,
      },
      answerForm: {
        template: toRuntimeAnswerFormTemplate(managed),
        source: "QUIZ",
        requestedId: templateId,
        usedFallback: false,
      },
    });
  }, [config, scenario, templateId, templateName]);

  if (scenario === "ANSWER_FORM") {
    return (
      <QuizThemeScope
        theme={theme}
        data-preview-surface={scenario}
        className="flex aspect-video min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--quiz-border)] bg-[var(--quiz-background)] p-6"
      >
        <div className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: theme.colors.primary }}>
          Antwortformular
        </div>
        <h2 className="mt-4 text-3xl font-black">Welche Hauptstadt gehört zu Deutschland?</h2>
        <div className="mt-5 grid flex-1 grid-cols-2 gap-3">
          {["Berlin", "Hamburg", "München", "Köln"].map((answer) => (
            <div key={answer} className="flex items-center rounded-xl border px-4 text-lg font-bold" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
              {answer}
            </div>
          ))}
        </div>
        <button type="button" className="mt-4 min-h-11 rounded-xl px-5 font-bold" style={{ background: theme.colors.primary, color: theme.colors.background }}>
          Antwort abgeben
        </button>
      </QuizThemeScope>
    );
  }

  const quiz = buildPreviewQuiz(scenario);
  const slide: Slide = {
    typ: scenario === "SOLUTION" || scenario === "BIRTHDAY_SOLUTION" || scenario === "CORPORATE_SOLUTION" ? "aufloesung" : "frage",
    abschnitt: quiz.abschnitte[0],
    frage: quiz.fragen[0],
    frageIndexImBlock: 1,
    fragenAnzahlImBlock: 1,
  };
  return (
    <div className="aspect-video min-h-0 overflow-hidden rounded-2xl bg-black p-2">
      <PresentationSlideRenderer
        quiz={quiz}
        slide={slide}
        slides={[slide]}
        slideIndex={0}
        slideLabel="Vorschau"
        theme={theme}
        displayState={{
          ...displayState,
          renderMode:
            scenario === "MODERATION"
              ? "MODERATION_PREVIEW"
              : "DESIGN_PREVIEW",
        }}
      />
    </div>
  );
}
