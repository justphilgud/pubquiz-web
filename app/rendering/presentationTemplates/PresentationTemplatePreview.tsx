"use client";

/* eslint-disable @next/next/no-img-element -- Generator previews render dynamic repository or managed Blob template assets. */

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { QuizPraesentationResult } from "@/app/quiz/actions";
import type { Slide } from "@/app/quiz/[quizId]/praesentation/buildPraesentationSlides";
import type {
  QuizFlowConfig,
  QuizFlowItem,
  QuizFlowItemType,
} from "@/app/quiz/flow/quizFlow";
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
import type { PresentationDesignStyle } from "@/app/rendering/templateRegistry";
import type { PresentationTemplateAssetRole } from "./presentationTemplateAssets";

export const presentationPreviewGroupLabels = {
  QUESTIONS: "Fragen",
  SOLUTION: "Auflösung",
  QUIZ_SLIDES: "Quiz-Slides",
  STORYBOOK: "Storybook-Layouts",
  MORE: "Weitere Ansichten",
} as const;

export type PresentationPreviewGroupId = keyof typeof presentationPreviewGroupLabels;
export type PresentationPreviewRenderer = "QUESTION" | "SOLUTION" | "FLOW" | "ANSWER_FORM";

type PresentationPreviewDefinitionBase = {
  id: string;
  label: string;
  group: PresentationPreviewGroupId;
  renderer: PresentationPreviewRenderer;
  purpose: string;
  uniqueVisualState: boolean;
  storybookOnly?: true;
  flowType?: QuizFlowItemType;
};

export const presentationPreviewRegistry = [
  { id: "TEXT", label: "Standardfrage", group: "QUESTIONS", renderer: "QUESTION", purpose: "Textfrage ohne Medium", uniqueVisualState: true },
  { id: "MULTIPLE_CHOICE", label: "Multiple Choice", group: "QUESTIONS", renderer: "QUESTION", purpose: "Geschlossene Frage mit Antwortoptionen", uniqueVisualState: true },
  { id: "TRUE_FALSE", label: "Wahr/Falsch", group: "QUESTIONS", renderer: "QUESTION", purpose: "Binäre Wahr/Falsch-Frage", uniqueVisualState: true },
  { id: "IMAGE", label: "Bildfrage", group: "QUESTIONS", renderer: "QUESTION", purpose: "Medienfrage mit themebarem Bildzustand", uniqueVisualState: true },
  { id: "AUDIO", label: "Audiofrage", group: "QUESTIONS", renderer: "QUESTION", purpose: "Moderationsgesteuerte Audiofrage", uniqueVisualState: true },
  { id: "ORDERING", label: "Reihenfolge", group: "QUESTIONS", renderer: "QUESTION", purpose: "Frage mit sortierbaren Antwortwerten", uniqueVisualState: true },
  { id: "PIXEL", label: "Pixelbild / Reveal", group: "QUESTIONS", renderer: "QUESTION", purpose: "Schrittweiser visueller Reveal", uniqueVisualState: true },
  { id: "SOLUTION", label: "Richtige Antwort", group: "SOLUTION", renderer: "SOLUTION", purpose: "Kanonische Fragenauflösung", uniqueVisualState: true },
  { id: "WELCOME", label: "Begrüßung", group: "QUIZ_SLIDES", renderer: "FLOW", purpose: "Produktiver Begrüßungs-Slide", uniqueVisualState: true, flowType: "WELCOME" },
  { id: "RULES", label: "Regeln", group: "QUIZ_SLIDES", renderer: "FLOW", purpose: "Produktiver Regeln-Slide", uniqueVisualState: true, flowType: "RULES" },
  { id: "CHAPTER", label: "Kapitel", group: "QUIZ_SLIDES", renderer: "FLOW", purpose: "Produktiver Kapitel-Intro-Slide", uniqueVisualState: true, flowType: "CHAPTER_INTRO" },
  { id: "COUNTDOWN", label: "Countdown", group: "QUIZ_SLIDES", renderer: "FLOW", purpose: "Produktiver Countdown-Slide", uniqueVisualState: true, flowType: "COUNTDOWN" },
  { id: "BREAK", label: "Pause", group: "QUIZ_SLIDES", renderer: "FLOW", purpose: "Produktiver Pausen-Slide", uniqueVisualState: true, flowType: "BREAK" },
  { id: "INTERMEDIATE_STANDINGS", label: "Zwischenstand", group: "QUIZ_SLIDES", renderer: "FLOW", purpose: "Produktiver Zwischenstand", uniqueVisualState: true, flowType: "INTERMEDIATE_STANDINGS" },
  { id: "FINAL_STANDINGS", label: "Endstand", group: "QUIZ_SLIDES", renderer: "FLOW", purpose: "Produktiver Endstand", uniqueVisualState: true, flowType: "FINAL_STANDINGS" },
  { id: "CALENDAR", label: "Kalender / QR", group: "QUIZ_SLIDES", renderer: "FLOW", purpose: "Produktiver Kalender-Abo-Slide", uniqueVisualState: true, flowType: "CALENDAR_SUBSCRIPTION" },
  { id: "CLOSING", label: "Outro", group: "QUIZ_SLIDES", renderer: "FLOW", purpose: "Produktiver Abschluss-Slide", uniqueVisualState: true, flowType: "CLOSING" },
  { id: "STORYBOOK_COVER", label: "Cover", group: "STORYBOOK", renderer: "QUESTION", purpose: "Kuratiertes Storybook-Cover", uniqueVisualState: true, storybookOnly: true },
  { id: "STORYBOOK_CHAPTER", label: "Kapitelbogen", group: "STORYBOOK", renderer: "QUESTION", purpose: "Kuratiertes Storybook-Kapitel", uniqueVisualState: true, storybookOnly: true },
  { id: "STORYBOOK_EDITORIAL", label: "Editorial", group: "STORYBOOK", renderer: "QUESTION", purpose: "Redaktioneller Storybook-Textmoment", uniqueVisualState: true, storybookOnly: true },
  { id: "STORYBOOK_PORTRAIT", label: "Porträt", group: "STORYBOOK", renderer: "QUESTION", purpose: "Storybook-Porträtkomposition", uniqueVisualState: true, storybookOnly: true },
  { id: "STORYBOOK_SPLIT", label: "Split", group: "STORYBOOK", renderer: "QUESTION", purpose: "Storybook-Zweipersonenkomposition", uniqueVisualState: true, storybookOnly: true },
  { id: "STORYBOOK_SEQUENCE", label: "Sequenz", group: "STORYBOOK", renderer: "QUESTION", purpose: "Storybook-Bildsequenz", uniqueVisualState: true, storybookOnly: true },
  { id: "STORYBOOK_MEMORY", label: "Erinnerung", group: "STORYBOOK", renderer: "SOLUTION", purpose: "Storybook-Erinnerungsauflösung", uniqueVisualState: true, storybookOnly: true },
  { id: "ANSWER_FORM", label: "Antwortformular", group: "MORE", renderer: "ANSWER_FORM", purpose: "Begleitende Teamansicht", uniqueVisualState: true },
  { id: "MODERATION", label: "Moderationsansicht", group: "MORE", renderer: "QUESTION", purpose: "Read-only Kontrolle des produktiven Präsentationsrenderers", uniqueVisualState: false },
] as const satisfies readonly PresentationPreviewDefinitionBase[];

export type PresentationPreviewScenario = (typeof presentationPreviewRegistry)[number]["id"];
export type PresentationPreviewDefinition = (typeof presentationPreviewRegistry)[number];

export const presentationPreviewScenarios = presentationPreviewRegistry.map(
  ({ id, label }) => [id, label] as const,
);

export const storybookPresentationPreviewScenarios = presentationPreviewRegistry
  .filter((definition) => "storybookOnly" in definition)
  .map(({ id, label }) => [id, label] as const);

export function getPresentationPreviewGroups(style: PresentationDesignStyle) {
  const visibleDefinitions = presentationPreviewRegistry.filter(
    (definition) => !("storybookOnly" in definition) || style === "BIRTHDAY",
  );

  return (Object.keys(presentationPreviewGroupLabels) as PresentationPreviewGroupId[])
    .map((id) => ({
      id,
      label: presentationPreviewGroupLabels[id],
      scenarios: visibleDefinitions.filter((definition) => definition.group === id),
    }))
    .filter((group) => group.scenarios.length > 0);
}

function getPreviewDefinition(scenario: PresentationPreviewScenario): PresentationPreviewDefinition {
  return presentationPreviewRegistry.find((definition) => definition.id === scenario) as PresentationPreviewDefinition;
}

type Props = {
  config: PresentationTemplateConfig;
  templateId: string;
  templateName: string;
  scenario: PresentationPreviewScenario;
  highlightedAssetRole?: PresentationTemplateAssetRole | null;
};

const PREVIEW_STAGE_WIDTH = 1600;
const PREVIEW_STAGE_HEIGHT = 900;

const assetRoleLabels: Record<PresentationTemplateAssetRole, string> = {
  LOGO: "Logo erscheint hier",
  BACKGROUND: "Bühnenhintergrund füllt diese Fläche",
  HERO_IMAGE: "Key Visual erscheint hier",
  SOLUTION_IMAGE: "Auflösungsbild erscheint hier",
  IMAGE_POOL: "Bilder werden in diesen Medienflächen kuratiert",
  DECORATION: "Dekoration unterstützt die Bühnenränder",
};

function ScaledPreviewStage({
  children,
  highlightedAssetRole,
  scenario,
  renderer,
}: {
  children: ReactNode;
  highlightedAssetRole?: PresentationTemplateAssetRole | null;
  scenario: PresentationPreviewScenario;
  renderer: PresentationPreviewRenderer;
}) {
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
      data-preview-scenario={scenario}
      data-preview-renderer={renderer}
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
      {highlightedAssetRole && (
        <div
          data-preview-asset-highlight={highlightedAssetRole}
          className={`pointer-events-none absolute z-20 grid place-items-center rounded-xl border-2 border-dashed border-amber-300 bg-amber-100/20 p-2 text-center font-bold text-white shadow-[0_0_0_999px_rgba(15,23,42,0.28)] ${
            highlightedAssetRole === "LOGO"
              ? "left-[4%] top-[5%] h-[18%] w-[24%]"
              : highlightedAssetRole === "BACKGROUND"
                ? "inset-[3%]"
                : highlightedAssetRole === "DECORATION"
                  ? "inset-[7%]"
                  : "right-[6%] top-[22%] h-[58%] w-[42%]"
          }`}
        >
          <span className="rounded-lg bg-slate-950/85 px-3 py-2 text-xs sm:text-sm">
            {assetRoleLabels[highlightedAssetRole]}
          </span>
        </div>
      )}
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
      ? [scenario === "STORYBOOK_MEMORY" ? "Die Reise nach Berlin" : "Berlin"]
      : scenario === "TRUE_FALSE"
      ? ["Wahr", "Falsch"]
      : scenario === "ORDERING"
        ? ["Frühling", "Sommer", "Herbst", "Winter"]
        : ["Berlin", "Hamburg", "München", "Köln"];
  const runtimeMedia = scenario === "AUDIO"
    ? [{ fileName: "vorschau.mp3", mediaType: "Audio", scope: "QUESTION" as const }]
    : [];
  const layoutMedia = scenario === "IMAGE"
    ? [{ fileName: "bildvorschau.jpg", mediaType: "Bild", scope: "QUESTION" as const }]
    : runtimeMedia;
  const layoutInput = {
    templateId,
    questionText: scenario.startsWith("STORYBOOK_")
      ? "In welcher Stadt begann unsere erste gemeinsame Reise?"
      : "Welche Hauptstadt gehört zu Deutschland?",
    answerOptionCount: answers.length,
    structuredFieldCount: 0,
    media: layoutMedia,
  };

  return {
    quiz_fragen_id: 1,
    quiz_abschnitt_id: 1,
    sortierung: 1,
    fragen_id: 1,
    frage:
      scenario === "STORYBOOK_COVER"
        ? "Unsere gemeinsame Geschichte"
        : scenario === "STORYBOOK_CHAPTER"
          ? "Gemeinsame Reisen"
          : scenario === "STORYBOOK_PORTRAIT"
            ? "Wer trägt dieses Lächeln seit 2014 in jede neue Geschichte?"
            : scenario === "STORYBOOK_SPLIT"
              ? "Wo begann die Freundschaft, die bis heute jedes Wiedersehen prägt?"
              : scenario === "STORYBOOK_SEQUENCE"
                ? "Welche drei Augenblicke erzählen diesen Sommer am besten?"
                : scenario === "STORYBOOK_MEMORY"
                  ? "In welcher Stadt begann unsere erste gemeinsame Reise?"
                  : scenario === "STORYBOOK_EDITORIAL"
                    ? "In welcher Stadt begann unsere erste gemeinsame Reise?"
                    : scenario === "AUDIO"
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
    medien: runtimeMedia.map((medium, index) => ({
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
    intro_startsequenz_text: null,
    outro_bekanntmachungen: "Danke fürs Mitspielen!",
    outro_musik_url: null,
    titel: "Designvorschau",
    ablaufElemente: [],
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

function buildPreviewFlowConfig(type: QuizFlowItemType): QuizFlowConfig {
  const base = { version: 1 as const };

  if (type === "WELCOME") return {
    ...base,
    title: "Willkommen zum PubQuiz",
    subtitle: "LOVD × ungegoogelt",
    body: "Macht es euch gemütlich – gleich beginnt der gemeinsame Quizabend.",
  };
  if (type === "RULES") return {
    ...base,
    title: "So läuft der Abend",
    rules: [
      "Bildet ein Team und wählt einen Namen.",
      "Ein Gerät pro Team reicht aus.",
      "Antworten rechtzeitig absenden.",
      "Fair bleiben und nicht googeln.",
      "Bei Fragen hilft die Moderation.",
      "Vor allem: gemeinsam Spaß haben.",
    ].map((text, index) => ({ id: `preview-rule-${index + 1}`, text, enabled: true })),
  };
  if (type === "CHAPTER_INTRO") return {
    ...base,
    title: "Runde 2",
    subtitle: "Musik, Reisen und gute Geschichten",
    body: "Jetzt wird es ein bisschen kniffliger.",
  };
  if (type === "COUNTDOWN") return {
    ...base,
    title: "Antworten jetzt abschicken",
    body: "Die Zeit läuft.",
    durationSeconds: 30,
    showCountdown: true,
  };
  if (type === "BREAK") return {
    ...base,
    title: "Kurze Pause",
    body: "Gleich geht’s weiter.",
    durationSeconds: 300,
    showCountdown: true,
  };
  if (type === "INTERMEDIATE_STANDINGS") return {
    ...base,
    title: "Aktueller Zwischenstand",
    standingsSize: "TOP_5",
    showPoints: true,
  };
  if (type === "FINAL_STANDINGS") return {
    ...base,
    title: "Das Ergebnis",
    standingsSize: "TOP_5",
    showPoints: true,
  };
  if (type === "CALENDAR_SUBSCRIPTION") return {
    ...base,
    title: "Kein PubQuiz mehr verpassen",
    body: "Abonniert die nächsten Termine direkt in eurem Kalender.",
    teamHint: "Ein Kalender für alle öffentlichen ungegoogelt Quizabende.",
  };
  if (type === "CLOSING") return {
    ...base,
    title: "Danke fürs Mitspielen",
    subtitle: "Kommt gut nach Hause",
    body: "Wir sehen uns beim nächsten Quizabend.",
  };

  throw new Error(`Kein Preview-Fixture für Flow-Typ ${type}.`);
}

function buildPreviewFlowSlide(
  definition: PresentationPreviewDefinition,
): Extract<Slide, { typ: "ablauf" }> {
  if (!("flowType" in definition) || !definition.flowType) {
    throw new Error(`Preview ${definition.id} hat keinen Flow-Typ.`);
  }

  const element: QuizFlowItem = {
    id: `preview-${definition.id.toLocaleLowerCase("de-DE")}`,
    persistentId: null,
    type: definition.flowType,
    anchorType: "BEFORE_QUIZ",
    anchorKey: "QUIZ",
    sectionId: null,
    order: 10,
    enabled: true,
    label: definition.label,
    config: buildPreviewFlowConfig(definition.flowType),
    configVersion: 1,
    questionAssignmentId: null,
    isStandard: true,
  };

  return { typ: "ablauf", abschnitt: null, element };
}

function configureStorybookScenario(config: PresentationTemplateConfig, scenario: PresentationPreviewScenario) {
  const storybook = config.design.storybook;
  if (!storybook || !scenario.startsWith("STORYBOOK_")) return;
  const peopleByScenario = {
    STORYBOOK_COVER: ["Migge", "Paul", "Philipp", "Gabi", "Helena"],
    STORYBOOK_CHAPTER: ["Migge", "Paul", "Philipp", "Gabi", "Helena"],
    STORYBOOK_EDITORIAL: ["Migge", "Paul"],
    STORYBOOK_PORTRAIT: ["Migge"],
    STORYBOOK_SPLIT: ["Migge", "Paul"],
    STORYBOOK_SEQUENCE: ["Migge", "Paul", "Philipp"],
    STORYBOOK_MEMORY: ["Migge", "Paul"],
  } as const;
  const names = peopleByScenario[scenario as keyof typeof peopleByScenario];
  storybook.people = names.map((name, index) => ({
    id: name.toLowerCase(),
    name,
    age: index === 0 ? "40" : null,
    subtitle: null,
    portrait: index % 2 === 0 ? "/medien/bilder/unsortiert/1778762143603-img_20140530_143045.jpg" : "/medien/bilder/unsortiert/1778762097227-20190714_112415.jpg",
  }));
  storybook.sharedTitle = "Unsere gemeinsame Geschichte";
  const portraitSources = [
    "/medien/bilder/unsortiert/1778762143603-img_20140530_143045.jpg",
    "/medien/bilder/unsortiert/1778762097227-20190714_112415.jpg",
    "/medien/bilder/unsortiert/1778763271536-20220503_095407.jpg",
    "/medien/bilder/unsortiert/1778787404351-2026-4-19-12-45-27.jpg",
    "/medien/bilder/unsortiert/1778787308845-20220503_095407.jpg",
  ] as const;
  storybook.assets = storybook.people.map((person, index) => ({
    id: `portrait-${person.id}`,
    source: portraitSources[index % portraitSources.length],
    role: "PORTRAIT" as const,
    personIds: [person.id],
    alt: `Porträt von ${person.name}`,
    caption: ["Ein freier Nachmittag am See", "Sonntagmorgen in der Stadt", "Der erste Tag der Reise", "Ein Wiedersehen im Frühling", "Unterwegs mit der ganzen Runde"][index] ?? null,
    year: ["2014", "2019", "2022", "2024", "2026"][index] ?? null,
    order: index,
  }));
  storybook.assets.push({
    id: "shared-solution",
    source: "/medien/bilder/unsortiert/1778787308845-20220503_095407.jpg",
    role: "SOLUTION",
    personIds: storybook.people.map((person) => person.id),
    alt: "Gemeinsame Reiseerinnerung",
    caption: "Der Augenblick, in dem die Reise zur gemeinsamen Geschichte wurde",
    year: "2022",
    order: storybook.assets.length,
  });
  storybook.anecdotes = scenario === "STORYBOOK_MEMORY"
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
  if (theme.design.stylePreset === "EDITORIAL") {
    return (
      <QuizThemeScope theme={theme} data-preview-surface="ANSWER_FORM" className="answer-template flex h-full w-full flex-col overflow-hidden bg-[var(--quiz-background)] px-20 py-14">
        <header className="flex items-start justify-between">
          {theme.identity.logoUrl && <img src={theme.identity.logoUrl} alt="LOVD STELP" className="answer-editorial-logo" />}
          <span className="pt-4 text-sm font-semibold uppercase tracking-[.22em] text-[var(--quiz-text-muted)]">Frage 01 / 10</span>
        </header>
        <div className="mt-12 max-w-5xl text-sm font-semibold uppercase tracking-[.22em] text-[var(--quiz-accent)]">Frage 01</div>
        <h2 className="mt-5 max-w-5xl text-5xl font-medium leading-tight">Welche Hauptstadt gehört zu Deutschland?</h2>
        <div className="mt-10 grid flex-1 content-center gap-0">
          {answers.map((answer, index) => <div key={answer} className="answer-surface grid grid-cols-[4rem_1fr] items-center border-t border-[var(--quiz-border)] py-5 text-xl"><span className="text-[var(--quiz-accent)]">{String.fromCharCode(65 + index)}</span><span>{answer}</span></div>)}
        </div>
        <button type="button" className="mt-7 min-h-14 self-end bg-[var(--quiz-accent)] px-12 text-base font-semibold uppercase tracking-[.16em] text-[var(--quiz-text)]">Antwort senden</button>
      </QuizThemeScope>
    );
  }
  if (theme.design.stylePreset === "CORPORATE") {
    return <QuizThemeScope theme={theme} data-preview-surface="ANSWER_FORM" className="answer-template flex h-full w-full flex-col overflow-hidden bg-[var(--quiz-background)] p-14"><header className="flex items-center justify-between border-b-4 border-[var(--quiz-primary)] bg-white px-7 py-5"><div><div className="text-xs font-bold uppercase tracking-[.16em] text-[var(--quiz-primary)]">Corporate Quiz · Antwort</div><h2 className="mt-1 text-3xl font-extrabold">Welche Hauptstadt gehört zu Deutschland?</h2></div><span className="text-xl font-semibold tabular-nums">01 / 10</span></header><div className="mt-7 grid flex-1 content-center gap-3">{answers.map((answer, index) => <div key={answer} className="answer-surface grid grid-cols-[4rem_1fr] items-center border bg-white text-xl font-semibold"><span className="grid h-full place-items-center bg-[var(--quiz-surface-strong)] py-5 text-[var(--quiz-primary)]">{String.fromCharCode(65 + index)}</span><span className="px-5">{answer}</span></div>)}</div><button type="button" className="mt-6 min-h-14 self-end bg-[var(--quiz-primary)] px-12 text-lg font-bold text-white">Antwort übermitteln</button></QuizThemeScope>;
  }
  if (theme.design.stylePreset === "BIRTHDAY") {
    return (
      <QuizThemeScope theme={theme} data-preview-surface="ANSWER_FORM" className="answer-template flex h-full w-full flex-col overflow-hidden bg-[var(--quiz-background)] px-20 py-14">
        <header className="flex items-end justify-between border-b border-[var(--quiz-border)] pb-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-[.2em] text-[var(--quiz-primary)]">
              {theme.design.storybook ? getStorybookTitle(theme.design.storybook) : "Storybook"}
            </div>
            <h2 className="mt-4 max-w-4xl font-serif text-5xl font-medium leading-tight tracking-tight">
              Welche Hauptstadt gehört zu Deutschland?
            </h2>
          </div>
          <span className="text-sm font-bold tabular-nums text-[var(--quiz-text-muted)]">01 — 10</span>
        </header>
        <div className="mt-9 grid flex-1 content-center gap-0">
          {answers.map((answer, index) => (
            <div key={answer} className="answer-surface grid grid-cols-[3.5rem_1fr] items-center border-t border-[var(--quiz-border)] py-5 text-xl font-semibold">
              <span className="font-serif text-2xl font-medium text-[var(--quiz-primary)]">{String.fromCharCode(65 + index)}</span>
              {answer}
            </div>
          ))}
        </div>
        <button type="button" className="mt-7 min-h-14 self-end border border-[var(--quiz-primary)] px-12 text-base font-bold text-[var(--quiz-primary)]">
          Antwort übermitteln
        </button>
      </QuizThemeScope>
    );
  }
  return <QuizThemeScope theme={theme} data-preview-surface="ANSWER_FORM" className="answer-template flex h-full w-full min-h-0 flex-col overflow-hidden border border-[var(--quiz-border)] bg-[var(--quiz-background)] p-12"><div className="text-xs font-black uppercase tracking-[0.25em] text-[var(--quiz-primary)]">Antwortformular · Live Show</div><h2 className="mt-4 text-4xl font-black uppercase">Welche Hauptstadt gehört zu Deutschland?</h2><div className="mt-5 grid flex-1 grid-cols-2 gap-4">{answers.map((answer) => <div key={answer} className="answer-surface flex items-center rounded-2xl border-4 px-5 text-xl font-black shadow-[5px_5px_0_var(--quiz-secondary)]">{answer}</div>)}</div><button type="button" className="mt-5 min-h-14 skew-x-[-4deg] rounded-xl bg-[var(--quiz-primary)] px-5 text-lg font-black uppercase text-[var(--quiz-background)] shadow-[5px_5px_0_var(--quiz-secondary)]">Antwort abgeben</button></QuizThemeScope>;
}

export function PresentationTemplatePreview({
  config,
  templateId,
  templateName,
  scenario,
  highlightedAssetRole,
}: Props) {
  const definition = getPreviewDefinition(scenario);
  const theme = useMemo(() => {
    const effectiveConfig = structuredClone(config);
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
      <ScaledPreviewStage
        highlightedAssetRole={highlightedAssetRole}
        scenario={scenario}
        renderer={definition.renderer}
      >
        <AnswerFormDesignPreview theme={theme} />
      </ScaledPreviewStage>
    );
  }

  const quiz = buildPreviewQuiz(scenario);
  const slide: Slide = definition.renderer === "FLOW"
    ? buildPreviewFlowSlide(definition)
    : {
        typ: definition.renderer === "SOLUTION" ? "aufloesung" : "frage",
        abschnitt: quiz.abschnitte[0],
        frage: quiz.fragen[0],
        frageIndexImBlock: 1,
        fragenAnzahlImBlock: 1,
      };
  return (
    <ScaledPreviewStage
      highlightedAssetRole={highlightedAssetRole}
      scenario={scenario}
      renderer={definition.renderer}
    >
      <PresentationSlideRenderer
        quiz={quiz}
        slide={slide}
        slides={[slide]}
        slideIndex={0}
        slideLabel={definition.label}
        theme={theme}
        displayState={{
          ...displayState,
          renderMode:
            scenario === "MODERATION"
              ? "MODERATION_PREVIEW"
              : "DESIGN_PREVIEW",
        }}
        storybookContext={scenario === "STORYBOOK_COVER"
          ? { contentKind: "COVER" }
          : scenario === "STORYBOOK_CHAPTER"
            ? { contentKind: "CHAPTER" }
            : scenario === "STORYBOOK_EDITORIAL"
              ? { contentKind: "TEXT" }
              : scenario === "STORYBOOK_PORTRAIT"
                ? { personIds: theme.design.storybook?.people.slice(0, 1).map((person) => person.id), contentKind: "IMAGE" }
                : scenario === "STORYBOOK_SPLIT"
                  ? { personIds: theme.design.storybook?.people.slice(0, 2).map((person) => person.id), contentKind: "IMAGE" }
                  : scenario === "STORYBOOK_SEQUENCE"
                    ? { personIds: theme.design.storybook?.people.map((person) => person.id), contentKind: "IMAGE" }
                    : undefined}
      />
    </ScaledPreviewStage>
  );
}
