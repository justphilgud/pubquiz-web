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
import { resolvePresentationLayout } from "./presentationLayoutResolver";
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

test("open solutions render short and long canonical answers without fake alternatives", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 1 });
  const theme = structuredClone(runtime.theme);
  theme.design.stylePreset = "EDITORIAL";

  for (const solutionText of ["7", "Never Gonna Give You Up"]) {
    const baseQuestion = runtime.quiz.fragen[0];
    assert.ok(baseQuestion);
    const answerId = 70;
    const layoutInput = {
      templateId: null,
      questionText: "Wie lautet die gesuchte Lösung?",
      answerOptionCount: 1,
      structuredFieldCount: 0,
      media: [],
    };
    const question = {
      ...baseQuestion,
      frage: "Wie lautet die gesuchte Lösung?",
      templateId: null,
      templateConfig: null,
      freie_antwort_erlaubt: true,
      urspruenglicher_antwortmodus: "OPEN" as const,
      effektiver_antwortmodus: "OPEN" as const,
      presentationLayouts: {
        question: resolvePresentationLayout({ ...layoutInput, phase: "QUESTION" }),
        solution: resolvePresentationLayout({ ...layoutInput, phase: "SOLUTION" }),
      },
      antwort_reihenfolge: [answerId],
      medien: [],
      bildMedien: [],
      antwortfelder: [],
      antworten: [{
        antwort_id: answerId,
        antwort: solutionText,
        ist_richtig: true,
        antworttyp: "Text",
        medien: [],
      }],
    };
    const quiz = { ...runtime.quiz, fragen: [question] };
    const slide: Slide = {
      typ: "aufloesung",
      abschnitt: quiz.abschnitte[0],
      frage: question,
      frageIndexImBlock: 1,
      fragenAnzahlImBlock: 1,
    };
    const html = renderToStaticMarkup(createElement(PresentationSlideRenderer, {
      quiz,
      slide,
      slides: [slide],
      slideIndex: 0,
      slideLabel: "Offene Frage · Auflösung",
      theme,
      displayState,
    }));

    assert.match(html, /data-presentation-layout="SOLUTION_FOCUS"/);
    assert.match(html, /data-correct="true"/);
    assert.ok(html.includes(solutionText));
    assert.doesNotMatch(html, /presentation-solution-option/);
    assert.equal((html.match(/presentation-correct-answer-value/g) ?? []).length, 1);
  }
});

test("FaceMorph keeps structured answer fields out of the question slide and reveals both people", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 1 });
  const baseQuestion = runtime.quiz.fragen[0];
  assert.ok(baseQuestion);
  const faceMorphQuestion = {
    ...baseQuestion,
    frage: "Welche zwei Personen wurden hier kombiniert?",
    templateId: null,
    templateConfig: null,
    presentationLayouts: {
      question: { variant: "STRUCTURED_RESPONSE" as const, source: "AUTO" as const, reason: "STRUCTURED_RESPONSE" as const },
      solution: { variant: "SOLUTION_FOCUS" as const, source: "AUTO" as const, reason: "SOLUTION_PHASE" as const },
    },
    medien: [{
      medien_id: 42,
      datei: "questions/face-morph.webp",
      medientyp: "Bild",
      sortierung: 1,
      bemerkung: null,
      slotKey: "face_morph_result",
    }],
    bildMedien: [{
      medien_id: 42,
      datei: "questions/face-morph.webp",
      medientyp: "Bild",
      slotKey: "face_morph_result",
    }],
    antworten: [],
    antwortfelder: [
      { antwortfeld_id: 1, label: "Person A", sortierung: 1, ist_pflicht: true, medien: [], loesungen: [{ loesung_text: "Taylor Swift", sortierung: 1, ist_akzeptiert: true }] },
      { antwortfeld_id: 2, label: "Person B", sortierung: 2, ist_pflicht: true, medien: [], loesungen: [{ loesung_text: "Albert Einstein", sortierung: 1, ist_akzeptiert: true }] },
    ],
  };
  const quiz = { ...runtime.quiz, fragen: [faceMorphQuestion] };
  const questionSlide: Slide = { typ: "frage", abschnitt: quiz.abschnitte[0], frage: faceMorphQuestion, frageIndexImBlock: 1, fragenAnzahlImBlock: 1 };
  const solutionSlide: Slide = { typ: "aufloesung", abschnitt: quiz.abschnitte[0], frage: faceMorphQuestion, frageIndexImBlock: 1, fragenAnzahlImBlock: 1 };
  const theme = structuredClone(runtime.theme);

  const questionHtml = renderToStaticMarkup(createElement(PresentationSlideRenderer, {
    quiz, slide: questionSlide, slides: [questionSlide, solutionSlide], slideIndex: 0,
    slideLabel: "FACEMORPH", theme, displayState,
  }));
  const solutionHtml = renderToStaticMarkup(createElement(PresentationSlideRenderer, {
    quiz, slide: solutionSlide, slides: [questionSlide, solutionSlide], slideIndex: 1,
    slideLabel: "FACEMORPH · AUFLÖSUNG", theme, displayState,
  }));

  assert.match(questionHtml, /data-question-template="face_morph"/);
  assert.match(questionHtml, /questions\/face-morph\.webp/);
  assert.doesNotMatch(questionHtml, /Mehrteilige Antwort|Antwortteil|Person A|Person B|Pflichtangabe/);
  assert.match(solutionHtml, /questions\/face-morph\.webp/);
  assert.match(solutionHtml, /Person A/);
  assert.match(solutionHtml, /Taylor Swift/);
  assert.match(solutionHtml, /Person B/);
  assert.match(solutionHtml, /Albert Einstein/);
});

test("public interim standings expose competition ranks and points without identity", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 1 });
  const slide: Slide = {
    typ: "ablauf",
    abschnitt: runtime.quiz.abschnitte[0],
    element: {
      id: "interim-test",
      persistentId: null,
      type: "INTERMEDIATE_STANDINGS",
      anchorType: "ROUND_END",
      anchorKey: "1",
      sectionId: runtime.quiz.abschnitte[0]?.quiz_abschnitt_id ?? null,
      order: 1,
      enabled: true,
      label: "Zwischenstand",
      config: { version: 1, title: "Zwischenstand", standingsSize: "ALL", showPoints: true },
      configVersion: 1,
      questionAssignmentId: null,
      isStandard: true,
    },
  };
  const scores = [
    { teamId: 1, teamname: "Geheimes Team Alpha", punkte: 90, avatarCode: "teekanne" as const, photoUrl: "/secret-alpha.jpg" },
    { teamId: 2, teamname: "Geheimes Team Beta", punkte: 70, avatarCode: "wecker" as const, photoUrl: "/secret-beta.jpg" },
    { teamId: 3, teamname: "Geheimes Team Gamma", punkte: 70, avatarCode: "tischlampe" as const, photoUrl: null },
    { teamId: 4, teamname: "Geheimes Team Delta", punkte: 40, avatarCode: "gummistiefel" as const, photoUrl: null },
  ];
  const render = (renderMode: PresentationSlideDisplayState["renderMode"]) =>
    renderToStaticMarkup(createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide,
      slides: [slide],
      slideIndex: 0,
      slideLabel: "ZWISCHENSTAND",
      theme: runtime.theme,
      displayState: { ...displayState, renderMode, punktestand: scores },
    }));

  const publicHtml = render("PRESENTATION");
  assert.match(publicHtml, />1<\/span><strong[^>]*>1\. Platz/);
  assert.equal((publicHtml.match(/>2<\/span><strong[^>]*>2\. Platz/g) ?? []).length, 2);
  assert.match(publicHtml, />4<\/span><strong[^>]*>4\. Platz/);
  assert.match(publicHtml, /90 Punkte/);
  assert.doesNotMatch(publicHtml, /Geheimes Team|secret-alpha|secret-beta/);

  const moderationHtml = render("MODERATION_PREVIEW");
  assert.match(moderationHtml, /Geheimes Team Alpha/);
  assert.match(moderationHtml, /secret-alpha\.jpg/);
});

test("podium ceremony reveals 3-2-1 before the full final table", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 1 });
  const finalSlide: Slide = {
    typ: "ablauf",
    abschnitt: runtime.quiz.abschnitte[0],
    element: {
      id: "final-test",
      persistentId: null,
      type: "FINAL_STANDINGS",
      anchorType: "AFTER_QUIZ",
      anchorKey: "QUIZ",
      sectionId: null,
      order: 1,
      enabled: true,
      label: "Endstand",
      config: { version: 1, title: "Finale Tabelle", standingsSize: "TOP_5", showPoints: true },
      configVersion: 1,
      questionAssignmentId: null,
      isStandard: true,
    },
  };
  const podiumSlide: Slide = {
    ...finalSlide,
    element: {
      ...finalSlide.element,
      id: "podium-test",
      type: "WINNER",
      label: "Siegerehrung",
      config: { version: 1, title: "Das Podium", standingsSize: "TOP_3", showPoints: true },
    },
  };
  const scores = Array.from({ length: 12 }, (_, index) => ({
    teamId: index + 1,
    teamname: `Finalteam ${index + 1}`,
    punkte: 120 - index * 5,
    avatarCode: "teekanne" as const,
    photoUrl: null,
  }));
  const render = (slide: Slide, revealCount: number, count = 5) =>
    renderToStaticMarkup(createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide,
      slides: [podiumSlide, finalSlide],
      slideIndex: 0,
      slideLabel: "ENDSTAND",
      theme: runtime.theme,
      displayState: {
        ...displayState,
        renderMode: "PRESENTATION",
        endstandRevealCount: revealCount,
        punktestand: scores.slice(0, count),
      },
    }));

  const placeThree = render(podiumSlide, 1);
  assert.match(placeThree, /Finalteam 3/);
  assert.doesNotMatch(placeThree, /Finalteam 1|Finalteam 2|Finalteam 4/);
  const placeTwo = render(podiumSlide, 2);
  assert.match(placeTwo, /Finalteam 2/);
  assert.match(placeTwo, /Finalteam 3/);
  assert.doesNotMatch(placeTwo, /Finalteam 1|Finalteam 4/);
  const placeOne = render(podiumSlide, 3);
  assert.match(placeOne, /Finalteam 1/);
  assert.doesNotMatch(placeOne, /Finalteam 4/);

  for (const count of [5, 8, 10, 12]) {
    const full = render(finalSlide, 1, count);
    for (let index = 1; index <= count; index += 1) {
      assert.match(full, new RegExp(`Finalteam ${index}(?!\\d)`));
    }
    assert.doesNotMatch(full, /Noch geheim/);
  }
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
  assert.match(rendererSource, /teamJoinState\.teams\.map/);
  assert.match(rendererSource, /teamJoinState\.remainingTeams > 0/);
  assert.match(rendererSource, /\+ \{teamJoinState\.remainingTeams\} weitere/);
});

test("join slide keeps the QR dominant and renders compact identity chips for up to twelve teams", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 1 });
  const slide: Slide = {
    typ: "ablauf",
    abschnitt: null,
    element: {
      id: "join-test",
      persistentId: null,
      type: "QR_CODE",
      anchorType: "BEFORE_QUIZ",
      anchorKey: "QUIZ",
      sectionId: null,
      order: 1,
      enabled: true,
      label: "Mitspielen",
      config: { version: 1, title: "Jetzt mitspielen", teamHint: "QR-Code scannen" },
      configVersion: 1,
      questionAssignmentId: null,
      isStandard: true,
    },
  };

  for (const count of [3, 6, 9, 12]) {
    const teams = Array.from({ length: count }, (_, index) => ({
      teamId: index + 1,
      teamName: `Join Team ${index + 1}`,
      avatarCode: "teekanne" as const,
      photoUrl: index === 0 ? "/join-team-photo.jpg" : null,
    }));
    const html = renderToStaticMarkup(createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide,
      slides: [slide],
      slideIndex: 0,
      slideLabel: "MITMACHEN",
      theme: runtime.theme,
      displayState: {
        ...displayState,
        teamJoinState: { teams, totalTeams: count, remainingTeams: 0 },
      },
    }));

    assert.match(html, new RegExp(`data-team-count="${count}"`));
    assert.match(html, /presentation-flow-qr/);
    assert.match(html, /join-team-photo\.jpg/);
    for (let index = 1; index <= count; index += 1) {
      assert.match(html, new RegExp(`Join Team ${index}(?!\\d)`));
    }
    assert.equal((html.match(/presentation-team-join-chip/g) ?? []).length, count);
  }
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
