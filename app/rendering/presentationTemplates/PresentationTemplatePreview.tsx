"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { QuizPraesentationResult } from "@/app/quiz/actions";
import type { Slide } from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import PresentationSlideRenderer, {
  type PresentationSlideDisplayState,
} from "@/app/rendering/presentation/PresentationSlideRenderer";
import { resolvePresentationLayout } from "@/app/rendering/presentation/presentationLayoutResolver";
import { resolveQuizTheme } from "@/app/rendering/theme/quizTheme";
import { QuizThemeScope } from "@/app/rendering/theme/QuizThemeScope";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import { getStorybookTitle } from "./storybook";
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
  ["STORYBOOK_SINGLE", "Storybook · eine Person"],
  ["STORYBOOK_DUAL", "Storybook · zwei Personen"],
  ["STORYBOOK_TRIO", "Storybook · drei Personen"],
  ["STORYBOOK_GROUP", "Storybook · Gruppe"],
  ["STORYBOOK_ANECDOTE", "Storybook · mit Anekdote"],
  ["STORYBOOK_PERSON", "Storybook · Personenbezug"],
  ["STORYBOOK_SHARED", "Storybook · gemeinsame Frage"],
  ["STORYBOOK_CHAPTER", "Storybook · Kapitel"],
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

const PREVIEW_STAGE_WIDTH = 1600;
const PREVIEW_STAGE_HEIGHT = 900;

function ScaledPreviewStage({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateScale = () => {
      setScale(container.clientWidth / PREVIEW_STAGE_WIDTH);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      data-preview-scale-container
      className="relative aspect-video min-h-0 w-full overflow-hidden rounded-2xl bg-black"
    >
      <div
        data-preview-fixed-stage
        className="absolute left-0 top-0"
        style={{
          width: PREVIEW_STAGE_WIDTH,
          height: PREVIEW_STAGE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

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
    scenario.startsWith("STORYBOOK_")
      ? ["Berlin"]
      : scenario === "TRUE_FALSE"
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

function configureStorybookScenario(config: PresentationTemplateConfig, scenario: PresentationPreviewScenario) {
  const storybook = config.design.storybook;
  if (!storybook || !scenario.startsWith("STORYBOOK_")) return;
  const peopleByScenario = {
    STORYBOOK_SINGLE: ["Migge"],
    STORYBOOK_DUAL: ["Migge", "Paul"],
    STORYBOOK_TRIO: ["Philipp", "Gabi", "Helena"],
    STORYBOOK_GROUP: ["Migge", "Paul", "Philipp", "Gabi", "Helena"],
  } as const;
  const names = scenario in peopleByScenario
    ? peopleByScenario[scenario as keyof typeof peopleByScenario]
    : ["Migge", "Paul"];
  storybook.people = names.map((name, index) => ({
    id: name.toLowerCase(),
    name,
    age: index === 0 ? "40" : null,
    subtitle: null,
    portrait: index % 2 === 0 ? "/medien/bilder/unsortiert/1778762143603-img_20140530_143045.jpg" : "/medien/bilder/unsortiert/1778762097227-20190714_112415.jpg",
  }));
  storybook.sharedTitle = names.length > 3 ? "Unsere gemeinsame Geschichte" : names.join(" & ");
  storybook.assets = [
    { id: "portrait-a", source: "/medien/bilder/unsortiert/1778762143603-img_20140530_143045.jpg", role: "PORTRAIT", personIds: [storybook.people[0]?.id].filter(Boolean) as string[], alt: `Porträt von ${storybook.people[0]?.name ?? "der Gruppe"}`, caption: null, year: "2014", order: 0 },
    { id: "portrait-b", source: "/medien/bilder/unsortiert/1778762097227-20190714_112415.jpg", role: "PORTRAIT", personIds: [storybook.people[1]?.id].filter(Boolean) as string[], alt: `Porträt von ${storybook.people[1]?.name ?? "der Gruppe"}`, caption: null, year: "2019", order: 1 },
    { id: "group-memory", source: "/medien/bilder/unsortiert/1778787308845-20220503_095407.jpg", role: "GROUP", personIds: storybook.people.map((person) => person.id), alt: "Gemeinsame Reiseerinnerung", caption: "Ein Tag, den niemand vergisst", year: "2022", order: 2 },
  ];
  storybook.anecdotes = scenario === "STORYBOOK_ANECDOTE"
    ? [{ id: "first-trip", text: "Damals begann eine Geschichte, die bis heute weitererzählt wird.", personIds: storybook.people.map((person) => person.id), year: "2007" }]
    : [];
  storybook.chapters = scenario === "STORYBOOK_CHAPTER"
    ? [{ id: "gemeinsame-reisen", title: "Gemeinsame Reisen", subtitle: "Geschichten von unterwegs", personIds: storybook.people.map((person) => person.id), order: 0 }]
    : [];
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

function AnswerFormDesignPreview({ theme }: { theme: ResolvedQuizTheme }) {
  const answers = ["Berlin", "Hamburg", "München", "Köln"];
  if (theme.design.stylePreset === "CORPORATE") {
    return <QuizThemeScope theme={theme} data-preview-surface="ANSWER_FORM" className="answer-template flex h-full w-full flex-col overflow-hidden bg-[var(--quiz-background)] p-14"><header className="flex items-center justify-between border-b-4 border-[var(--quiz-primary)] bg-white px-7 py-5"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-[var(--quiz-primary)]">Corporate Quiz · Antwort</div><h2 className="mt-1 text-3xl font-extrabold">Welche Hauptstadt gehört zu Deutschland?</h2></div><span className="text-xl font-semibold tabular-nums">01 / 10</span></header><div className="mt-7 grid flex-1 content-center gap-3">{answers.map((answer, index) => <div key={answer} className="answer-surface grid grid-cols-[4rem_1fr] items-center border bg-white text-xl font-semibold"><span className="grid h-full place-items-center bg-[var(--quiz-surface-strong)] py-5 text-[var(--quiz-primary)]">{String.fromCharCode(65 + index)}</span><span className="px-5">{answer}</span></div>)}</div><button type="button" className="mt-6 min-h-14 self-end bg-[var(--quiz-primary)] px-12 text-lg font-bold text-white">Antwort übermitteln</button></QuizThemeScope>;
  }
  if (theme.design.stylePreset === "BIRTHDAY") {
    return <QuizThemeScope theme={theme} data-preview-surface="ANSWER_FORM" className="answer-template relative flex h-full w-full flex-col overflow-hidden bg-[var(--quiz-background)] p-14"><span className="absolute left-7 top-1/3 h-5 w-16 rounded-full border-4 border-slate-400" aria-hidden="true" /><header className="border-8 border-white bg-[var(--quiz-surface)] px-8 py-6 shadow-lg"><div className="font-serif text-sm italic text-[var(--quiz-primary)]">{theme.design.storybook ? getStorybookTitle(theme.design.storybook) : "Erinnerungsalbum"}</div><h2 className="mt-2 font-serif text-4xl font-bold italic">Welche Hauptstadt gehört zu Deutschland?</h2></header><div className="mt-7 grid flex-1 grid-cols-2 content-center gap-5">{answers.map((answer, index) => <div key={answer} className="answer-surface border-4 border-white bg-white px-6 py-5 text-xl font-bold shadow-lg"><span className="mr-3 font-serif italic text-[var(--quiz-primary)]">{String.fromCharCode(65 + index)}.</span>{answer}</div>)}</div><button type="button" className="mt-5 min-h-14 self-center rounded-full bg-[var(--quiz-primary)] px-12 text-lg font-bold text-white shadow-lg">Antwort ins Album legen</button></QuizThemeScope>;
  }
  return <QuizThemeScope theme={theme} data-preview-surface="ANSWER_FORM" className="answer-template flex h-full w-full min-h-0 flex-col overflow-hidden border border-[var(--quiz-border)] bg-[var(--quiz-background)] p-12"><div className="text-xs font-black uppercase tracking-[0.25em] text-[var(--quiz-primary)]">Antwortformular · Live Show</div><h2 className="mt-4 text-4xl font-black uppercase">Welche Hauptstadt gehört zu Deutschland?</h2><div className="mt-5 grid flex-1 grid-cols-2 gap-4">{answers.map((answer) => <div key={answer} className="answer-surface flex items-center rounded-2xl border-4 px-5 text-xl font-black shadow-[5px_5px_0_var(--quiz-secondary)]">{answer}</div>)}</div><button type="button" className="mt-5 min-h-14 skew-x-[-4deg] rounded-xl bg-[var(--quiz-primary)] px-5 text-lg font-black uppercase text-[var(--quiz-background)] shadow-[5px_5px_0_var(--quiz-secondary)]">Antwort abgeben</button></QuizThemeScope>;
}

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
      if (effectiveConfig.design.storybook) effectiveConfig.design.storybook.assets = [];
    }
    configureStorybookScenario(effectiveConfig, scenario);
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
      <ScaledPreviewStage>
        <AnswerFormDesignPreview theme={theme} />
      </ScaledPreviewStage>
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
    <ScaledPreviewStage>
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
        storybookContext={["STORYBOOK_SINGLE", "STORYBOOK_DUAL", "STORYBOOK_TRIO", "STORYBOOK_GROUP"].includes(scenario)
          ? { contentKind: "IMAGE" }
          : scenario === "STORYBOOK_PERSON"
          ? { personIds: [theme.design.storybook?.people[0]?.id ?? ""], contentKind: "IMAGE" }
          : scenario === "STORYBOOK_SHARED"
            ? { personIds: theme.design.storybook?.people.slice(0, 2).map((person) => person.id), contentKind: "IMAGE" }
            : scenario === "STORYBOOK_CHAPTER"
              ? { contentKind: "CHAPTER" }
              : undefined}
      />
    </ScaledPreviewStage>
  );
}
