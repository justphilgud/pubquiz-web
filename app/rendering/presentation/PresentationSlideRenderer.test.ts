import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { buildStorybookExperienceRuntime } from "@/app/rendering/presentationTemplates/storybookExperienceFixture";
import PresentationSlideRenderer, {
  type PresentationSlideDisplayState,
} from "./PresentationSlideRenderer";
import type { Slide } from "../../quiz/[quizId]/praesentation/buildPraesentationSlides";

const rendererSource = readFileSync(
  new URL("./PresentationSlideRenderer.tsx", import.meta.url),
  "utf8",
);
const playerSource = readFileSync(
  new URL(
    "../../quiz/[quizId]/praesentation/QuizPraesentationPlayer.tsx",
    import.meta.url,
  ),
  "utf8",
);
const moderationPreviewSource = readFileSync(
  new URL(
    "../../quiz/[quizId]/moderation/components/CurrentSlidePanel.tsx",
    import.meta.url,
  ),
  "utf8",
);
const designSystemSource = readFileSync(
  new URL("./PresentationDesignSystem.tsx", import.meta.url),
  "utf8",
);
const globalStylesSource = readFileSync(
  new URL("../../globals.css", import.meta.url),
  "utf8",
);

const displayState: PresentationSlideDisplayState = {
  renderMode: "DESIGN_PREVIEW",
  templateRevealCount: 0,
  punktestand: [],
  endstandRevealCount: 0,
  now: Date.UTC(2026, 7, 21, 20),
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

test("renderer covers the central slide types without player orchestration", () => {
  for (const slideType of [
    '"fixer-slide"',
    '"block"',
    '"frage"',
    '"aufloesung"',
    '"pause"',
    '"zwischenstand"',
    '"endstand"',
  ]) {
    assert.match(rendererSource, new RegExp(slideType));
  }

  assert.match(rendererSource, /templateData\?\.kind === "GOOGLE_REVIEWS"/);
  assert.match(rendererSource, /renderMedienKarte/);
  for (const editorialType of [
    "IMAGE",
    "IMAGE_GALLERY",
    "TEXT",
    "QUOTE",
    "PORTRAIT",
    "MEDIA_SEQUENCE",
    "AUDIO",
    "VIDEO",
  ]) {
    assert.match(rendererSource, new RegExp(`type === "${editorialType}"`));
  }
  assert.match(rendererSource, /SynchronizedMedia kind="audio"/);
  assert.match(rendererSource, /SynchronizedMedia kind="video"/);
  assert.match(rendererSource, /type === "CALENDAR_SUBSCRIPTION"/);
  assert.match(rendererSource, /QRCode value=\{calendarUrl\}/);
  assert.doesNotMatch(rendererSource, /statusActions/);
  assert.doesNotMatch(
    rendererSource,
    /freigabeQuizBlock|schliesseQuizBlock|setPraesentationSlideIndex|starteQuiz/,
  );
  assert.doesNotMatch(rendererSource, /Zurück|Weiter →|setPraesentationSlideIndex/);
});

test("renderer exposes semantic hooks for LOVD badges, media and legacy flow slides", () => {
  for (const semanticHook of [
    "presentation-question-label",
    "presentation-solution-label",
    "presentation-solution-answer",
    "presentation-correct-answer-value",
    "presentation-audio-control",
    "presentation-media-fallback",
    "presentation-audio-status",
    "presentation-audio-waveform",
    "presentation-estimation-slide",
    "presentation-legacy-slide",
    "presentation-countdown-slide",
    "presentation-qr-slide",
    "presentation-runtime-status",
    "presentation-media-overlay",
  ]) {
    assert.match(rendererSource, new RegExp(semanticHook));
  }
  assert.match(rendererSource, /data-correct=\{antwort\.ist_richtig\}/);
  assert.match(rendererSource, /data-correct="true"/);
  assert.doesNotMatch(rendererSource, /PreviewAudioPlayer|presentation-preview-audio|presentation-audio-play-mark/);
});

test("LOVD rules keep every configured entry in the bounded slide layout", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 1 });
  const theme = structuredClone(runtime.theme);
  theme.design.stylePreset = "EDITORIAL";

  for (const count of [2, 4, 6]) {
    const rules = Array.from({ length: count }, (_, index) => ({
      id: `rule-${index + 1}`,
      text: `Regel ${index + 1}: gemeinsam fair und aufmerksam spielen`,
      enabled: true,
    }));
    const rulesSlide: Slide = {
      typ: "ablauf",
      abschnitt: null,
      element: {
        id: `rules-${count}`,
        persistentId: null,
        type: "RULES",
        anchorType: "BEFORE_QUIZ",
        anchorKey: "QUIZ",
        sectionId: null,
        order: 10,
        enabled: true,
        label: "Regeln",
        config: { version: 1, title: "Die Regeln", rules },
        configVersion: 1,
        questionAssignmentId: null,
        isStandard: true,
      },
    };
    const html = renderToStaticMarkup(createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide: rulesSlide,
      slides: [rulesSlide],
      slideIndex: 0,
      slideLabel: "REGELN",
      theme,
      displayState,
    }));

    assert.match(html, new RegExp(`data-rule-count="${count}"`));
    assert.match(html, new RegExp(`data-many="${count > 4}"`));
    for (let index = 1; index <= count; index += 1) {
      assert.match(html, new RegExp(`Regel ${index}:`));
    }
  }
});

test("LOVD logo framing and rules overflow are explicit theme contracts", () => {
  assert.match(designSystemSource, /data-logo-framing="lovd-wordmark"/);
  assert.match(globalStylesSource, /aspect-ratio:\s*2\.12 \/ 1/);
  assert.match(globalStylesSource, /presentation-flow-rules\[data-many="true"\]/);
  assert.match(globalStylesSource, /presentation-rules-slide > \.grid\[data-many="true"\]/);
  assert.match(
    globalStylesSource,
    /presentation-flow-slide\[data-flow-type="RULES"\][^{]*\{[\s\S]*?overflow:\s*visible/,
  );
});

test("player and moderation preview share the presentation renderer", () => {
  assert.match(playerSource, /<PresentationSlideRenderer/);
  assert.match(moderationPreviewSource, /<PresentationSlideRenderer/);
  assert.doesNotMatch(moderationPreviewSource, /<SlidePreview/);
});

test("calendar CTA leaves the team join QR payload and overflow UI intact", () => {
  assert.match(rendererSource, /QRCode value=\{answerUrl\}/);
  assert.match(rendererSource, /teamJoinState\.teamNames\.map/);
  assert.match(rendererSource, /teamJoinState\.remainingTeams > 0/);
  assert.match(rendererSource, /\+ \{teamJoinState\.remainingTeams\} weitere/);
});

test("translated reading keeps its TTS payload invisible and renders only the stored solution title", () => {
  const runtime = buildStorybookExperienceRuntime({
    questionCount: 30,
    personCount: 1,
  });
  const questionMoment = runtime.moments.find(
    (moment) => moment.kind === "QUESTION" && moment.questionType === "OPEN",
  );
  assert.ok(questionMoment?.slide.typ === "frage");
  const solutionMoment = runtime.moments.find(
    (moment) =>
      moment.kind === "SOLUTION" &&
      moment.questionNumber === questionMoment.questionNumber,
  );
  assert.ok(solutionMoment?.slide.typ === "aufloesung");
  const storedAnswer = questionMoment.slide.frage.antworten[0];
  assert.ok(storedAnswer);
  const translatedContext = "Sehr langer übersetzter Kontext. ".repeat(50);
  const translatedQuestion = {
    ...questionMoment.slide.frage,
    frage: "Welcher Songtext wurde hier übersetzt?",
    templateId: questionTemplateIds.translationReadAloud,
    templateConfig: {
      stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 },
      createPixelQuestionByAnswer: { answer1: false, answer2: false },
      templateData: {
        kind: "TRANSLATION_READ_ALOUD" as const,
        originalText: "I like big butts and I cannot lie",
        sourceLanguage: "en",
        targetLanguage: "de",
        translation: translatedContext,
        voiceProvider: "BROWSER" as const,
        voiceId: "default",
        voiceStyle: "",
        voiceInstruction: "",
        speed: 1,
      },
    },
    antworten: [
      {
        ...storedAnswer,
        antwort: "Baby Got Back",
        ist_richtig: true,
      },
    ],
    antwort_reihenfolge: [storedAnswer.antwort_id],
    medien: [
      {
        medien_id: 987_654,
        datei: "questions/translated-reading.mp3",
        medientyp: "Audio",
        sortierung: 1,
        bemerkung: null,
        slotKey: "lyrics_tts_audio",
      },
    ],
  };
  const questionSlide = {
    ...questionMoment.slide,
    frage: translatedQuestion,
  };
  const solutionSlide = {
    ...solutionMoment.slide,
    frage: translatedQuestion,
  };
  const slides = [questionSlide, solutionSlide];
  const theme = structuredClone(runtime.theme);
  theme.design.stylePreset = "NEON";

  const questionHtml = renderToStaticMarkup(
    createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide: questionSlide,
      slides,
      slideIndex: 0,
      slideLabel: "FRAGE",
      theme,
      displayState,
    }),
  );
  const solutionHtml = renderToStaticMarkup(
    createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide: solutionSlide,
      slides,
      slideIndex: 1,
      slideLabel: "AUFLÖSUNG",
      theme,
      displayState,
    }),
  );
  const presentationAudioHtml = renderToStaticMarkup(
    createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide: questionSlide,
      slides,
      slideIndex: 0,
      slideLabel: "FRAGE",
      theme,
      displayState: {
        ...displayState,
        renderMode: "PRESENTATION",
        mediaOverlayActive: true,
        playbackCommand: "play",
        playbackCommandId: 1,
      },
    }),
  );

  assert.match(questionHtml, /Welcher Songtext wurde hier übersetzt\?/);
  assert.match(questionHtml, /Audio über den konfigurierten TTS-Ausgabeslot/);
  assert.doesNotMatch(questionHtml, /Sehr langer übersetzter Kontext/);
  assert.doesNotMatch(questionHtml, /I like big butts and I cannot lie/);
  assert.match(solutionHtml, /Baby Got Back/);
  assert.doesNotMatch(solutionHtml, /Sehr langer übersetzter Kontext/);
  assert.match(
    presentationAudioHtml,
    /<audio[^>]+src="\/medien\/questions\/translated-reading\.mp3"/,
  );
  assert.doesNotMatch(
    presentationAudioHtml,
    /Sehr langer übersetzter Kontext/,
  );
});
