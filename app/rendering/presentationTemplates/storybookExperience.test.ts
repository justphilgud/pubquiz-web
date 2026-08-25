import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PresentationSlideRenderer, { type PresentationSlideDisplayState } from "@/app/rendering/presentation/PresentationSlideRenderer";
import {
  buildStorybookExperiencePlan,
  STORYBOOK_EXPERIENCE_PERSON_COUNTS,
  STORYBOOK_EXPERIENCE_QUESTION_COUNTS,
  STORYBOOK_EXPERIENCE_QUESTION_TYPES,
  type StorybookExperienceQuestionType,
  type StorybookExperienceMoment,
} from "./storybookExperience";
import { buildStorybookExperienceRuntime } from "./storybookExperienceFixture";

const compositions = ["COVER", "CHAPTER", "EDITORIAL", "PORTRAIT", "SPLIT", "SEQUENCE", "MEMORY"] as const;
const expectedQuestionLayouts: Record<StorybookExperienceQuestionType, string> = {
  OPEN: "CONTENT_CENTERED",
  MULTIPLE_CHOICE: "CHOICE_GRID",
  TRUE_FALSE: "TRUE_FALSE",
  ESTIMATE: "CONTENT_CENTERED",
  ORDERING: "ORDERING",
  AUDIO: "AUDIO_FOCUS",
  IMAGE: "MEDIA_FOCUS",
  PIXEL_REVEAL: "REVEAL_SEQUENCE",
  STRUCTURED_RESPONSE: "STRUCTURED_RESPONSE",
};
const displayState: PresentationSlideDisplayState = {
  renderMode: "DESIGN_PREVIEW",
  templateRevealCount: 2,
  punktestand: [],
  intermediateStandings: [],
  endstandRevealCount: 0,
  now: Date.UTC(2026, 7, 3, 20),
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

function momentAtSecond(moments: readonly StorybookExperienceMoment[], second: number) {
  let elapsed = 0;
  for (const moment of moments) {
    elapsed += moment.durationSeconds;
    if (elapsed >= second) return moment;
  }
  return moments.at(-1);
}

test("all nine complete evening simulations satisfy the dramaturgical contract", () => {
  for (const questionCount of STORYBOOK_EXPERIENCE_QUESTION_COUNTS) {
    for (const personCount of STORYBOOK_EXPERIENCE_PERSON_COUNTS) {
      const plan = buildStorybookExperiencePlan({ questionCount, personCount });
      assert.deepEqual(plan.review.issues, [], `${questionCount} questions / ${personCount} people`);
      assert.equal(plan.moments.filter((moment) => moment.kind === "QUESTION").length, questionCount);
      assert.equal(plan.moments.filter((moment) => moment.kind === "SOLUTION").length, questionCount);
      assert.equal(plan.moments.filter((moment) => moment.kind === "CHAPTER").length, questionCount / 10);
      assert.deepEqual(compositions.filter((composition) => plan.review.compositionCounts[composition] === 0), []);
      assert.equal(plan.moments[0].composition, "COVER");
      assert.equal(plan.moments.at(-1)?.composition, "MEMORY");
      assert.equal(plan.moments.at(-1)?.beat, "CLOSING");
      assert.equal(plan.review.longestQuestionTypeRun, 1);
      assert.deepEqual(STORYBOOK_EXPERIENCE_QUESTION_TYPES.filter((questionType) => plan.review.questionTypeCounts[questionType] === 0), []);
    }
  }
});

test("question types form a deliberate mixed rhythm and rare media accents", () => {
  const plan = buildStorybookExperiencePlan({ questionCount: 60, personCount: 3 });
  const questions = plan.moments.filter((moment) => moment.kind === "QUESTION");
  for (let index = 1; index < questions.length; index += 1) {
    assert.notEqual(questions[index].questionType, questions[index - 1].questionType);
  }
  const accents = questions.filter((moment) => moment.questionType === "AUDIO" || moment.questionType === "PIXEL_REVEAL");
  assert.ok(accents.length < questions.length / 10);
  assert.ok(accents.slice(1).every((moment, index) => (moment.questionNumber ?? 0) - (accents[index].questionNumber ?? 0) >= 8));
  const fastDurations = questions.filter((moment) => moment.questionType === "MULTIPLE_CHOICE" || moment.questionType === "TRUE_FALSE").map((moment) => moment.durationSeconds);
  const openDurations = questions.filter((moment) => moment.questionType === "OPEN").map((moment) => moment.durationSeconds);
  assert.ok(Math.max(...fastDurations) < Math.min(...openDurations));
});

test("memory, portrait and sequence moments keep deliberate breathing room", () => {
  const plan = buildStorybookExperiencePlan({ questionCount: 60, personCount: 3 });
  assert.ok(plan.review.memoryQuestionGaps.every((gap) => gap >= 5));
  assert.ok(plan.review.longestCompositionRun <= 2);
  for (let index = 1; index < plan.moments.length; index += 1) {
    const previous = plan.moments[index - 1];
    const current = plan.moments[index];
    assert.notEqual(`${previous.composition}:${current.composition}`, "MEMORY:MEMORY");
    assert.notEqual(`${previous.composition}:${current.composition}`, "PORTRAIT:PORTRAIT");
    assert.notEqual(`${previous.composition}:${current.composition}`, "SEQUENCE:SEQUENCE");
  }
  const momentsBeforeChapters = plan.moments
    .map((moment, index) => moment.kind === "CHAPTER" ? plan.moments[index - 1] : null)
    .filter((moment): moment is StorybookExperienceMoment => moment !== null);
  assert.ok(momentsBeforeChapters.every((moment) => moment.composition !== "MEMORY"));
});

test("chapters form ten-question arcs and minute fifteen remains inside the story", () => {
  const plan = buildStorybookExperiencePlan({ questionCount: 40, personCount: 2 });
  assert.deepEqual(plan.review.chapterRanges.map(({ firstQuestion, lastQuestion }) => [firstQuestion, lastQuestion]), [[1, 10], [11, 20], [21, 30], [31, 40]]);
  const minuteFifteen = momentAtSecond(plan.moments, 15 * 60);
  assert.ok(minuteFifteen);
  assert.ok(minuteFifteen.kind === "QUESTION" || minuteFifteen.kind === "SOLUTION");
  assert.ok(plan.review.quietMomentShare >= 0.4 && plan.review.quietMomentShare <= 0.6);
  assert.ok(plan.review.visualMomentShare >= 0.4 && plan.review.visualMomentShare <= 0.6);
});

test("image intentions follow narrative purpose instead of decoration", () => {
  const plan = buildStorybookExperiencePlan({ questionCount: 30, personCount: 1 });
  assert.equal(plan.moments[0].imageIntent, "ESTABLISHING");
  assert.ok(plan.moments.filter((moment) => moment.composition === "EDITORIAL").every((moment) => moment.imageIntent === "NONE"));
  assert.ok(plan.moments.filter((moment) => moment.composition === "PORTRAIT").every((moment) => moment.imageIntent === "CHARACTER"));
  assert.ok(plan.moments.filter((moment) => moment.composition === "SPLIT").every((moment) => moment.imageIntent === "RELATIONSHIP"));
  assert.ok(plan.moments.filter((moment) => moment.composition === "SEQUENCE").every((moment) => moment.imageIntent === "CHRONOLOGY"));
  assert.ok(plan.moments.filter((moment) => moment.composition === "MEMORY").every((moment) => moment.imageIntent === "REVEAL"));
  assert.ok(plan.moments.some((moment) => moment.revealMode === "ANSWER_ONLY"));
  assert.ok(plan.moments.some((moment) => moment.revealMode === "QUOTE"));
  assert.ok(plan.moments.some((moment) => moment.revealMode === "IMAGE_MEMORY"));
});

test("climax and closing resolutions carry more emotional weight than their questions", () => {
  const plan = buildStorybookExperiencePlan({ questionCount: 40, personCount: 3 });
  for (const beat of ["CLIMAX", "CLOSING"] as const) {
    const questions = plan.moments.filter((moment) => moment.kind === "QUESTION" && moment.beat === beat);
    for (const question of questions) {
      const solution = plan.moments.find((moment) => moment.kind === "SOLUTION" && moment.questionNumber === question.questionNumber);
      assert.ok(solution);
      assert.ok(solution.intensity > question.intensity);
      assert.ok(solution.durationSeconds >= 28);
    }
  }
  assert.equal(plan.moments.at(-1)?.title, "Was von all dem bleibt");
  assert.equal(plan.moments.at(-1)?.durationSeconds, 34);
});

test("one, two and three people receive balanced presence across the complete evening", () => {
  for (const personCount of STORYBOOK_EXPERIENCE_PERSON_COUNTS) {
    const plan = buildStorybookExperiencePlan({ questionCount: 60, personCount });
    assert.equal(plan.review.personExposure.length, personCount);
    assert.ok(plan.review.personExposure.every((exposure) => exposure > 0));
    assert.ok(Math.max(...plan.review.personExposure) - Math.min(...plan.review.personExposure) <= 1);
  }
});

test("the experience engine is deterministic and does not save simulation state", () => {
  const input = { questionCount: 40 as const, personCount: 3 as const };
  assert.deepEqual(buildStorybookExperiencePlan(input), buildStorybookExperiencePlan(input));
});

test("the internal runtime maps every planned moment to the shared renderer contract", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 2 });
  assert.equal(runtime.moments.length, runtime.plan.moments.length);
  assert.equal(runtime.slides.length, runtime.moments.length);
  assert.equal(runtime.theme.design.storybook?.people.length, 2);
  assert.ok(runtime.moments.every((moment) => moment.storybookContext.composition === moment.composition));
  assert.ok(runtime.moments.every((moment) => moment.storybookContext.personIds.length === moment.personSlots.length));
  assert.equal(runtime.moments[0].slide.typ, "frage");
  assert.equal(runtime.moments[0].storybookContext.composition, "COVER");
});

test("every productive experience question type uses automatic question and solution layouts", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 2 });
  for (const questionType of STORYBOOK_EXPERIENCE_QUESTION_TYPES) {
    const question = runtime.moments.find((moment) => moment.kind === "QUESTION" && moment.questionType === questionType);
    assert.ok(question, questionType);
    assert.equal(question.slide.typ, "frage");
    assert.equal(question.slide.frage.presentationLayouts.question.source, "AUTO");
    assert.equal(question.slide.frage.presentationLayouts.question.variant, expectedQuestionLayouts[questionType]);
    assert.notEqual(question.slide.frage.presentationLayouts.question.reason, "CONTRACT_FALLBACK");
    const solution = runtime.moments.find((moment) => moment.kind === "SOLUTION" && moment.questionNumber === question.questionNumber);
    assert.ok(solution);
    assert.equal(solution.slide.typ, "aufloesung");
    assert.equal(solution.slide.frage.presentationLayouts.solution.variant, "SOLUTION_FOCUS");
    assert.equal(solution.slide.frage.presentationLayouts.solution.source, "AUTO");
    assert.equal(solution.questionType, questionType);
  }
});

test("all experience question types render both phases without an open-question fallback", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 3 });
  const expectedQuestionContent: Record<StorybookExperienceQuestionType, string> = {
    OPEN: "Welche kleine Gewohnheit kennt hier wirklich jeder?",
    MULTIPLE_CHOICE: "Die verpasste letzte Straßenbahn",
    TRUE_FALSE: "Wahr",
    ESTIMATE: "Gesucht: eine Antwort in",
    ORDERING: "Treffen am Bahnhof",
    AUDIO: "data-preview-audio",
    IMAGE: "/medien/bilder/unsortiert/1778762143603-img_20140530_143045.jpg",
    PIXEL_REVEAL: "pixel-stage-2.svg",
    STRUCTURED_RESPONSE: "Teil 01",
  };

  for (const questionType of STORYBOOK_EXPERIENCE_QUESTION_TYPES) {
    const question = runtime.moments.find((moment) => moment.kind === "QUESTION" && moment.questionType === questionType);
    assert.ok(question);
    const questionIndex = runtime.moments.indexOf(question);
    const questionHtml = renderToStaticMarkup(createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide: question.slide,
      slides: runtime.slides,
      slideIndex: questionIndex,
      slideLabel: `FRAGE ${question.questionNumber}`,
      theme: runtime.theme,
      displayState,
      storybookContext: question.storybookContext,
    }));
    assert.match(questionHtml, new RegExp(`data-presentation-layout="${expectedQuestionLayouts[questionType]}"`));
    assert.ok(questionHtml.includes(expectedQuestionContent[questionType]), questionType);
    if (questionType === "AUDIO") {
      assert.ok(!questionHtml.includes(`src="/medien/audio/reverse/believe_reverse.wav"`));
      assert.ok(!questionHtml.includes("#38E8FF"));
      assert.ok(!questionHtml.includes("#FF3BD4"));
      assert.ok(!questionHtml.includes("#FFD83B"));
      assert.ok(!questionHtml.includes("shadow-[0_0"));
    }
    if (questionType === "PIXEL_REVEAL") {
      assert.ok(questionHtml.includes(`data-pixel-reveal-step="2"`));
    }

    const solution = runtime.moments.find((moment) => moment.kind === "SOLUTION" && moment.questionNumber === question.questionNumber);
    assert.ok(solution);
    const solutionHtml = renderToStaticMarkup(createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide: solution.slide,
      slides: runtime.slides,
      slideIndex: runtime.moments.indexOf(solution),
      slideLabel: "AUFLÖSUNG",
      theme: runtime.theme,
      displayState,
      storybookContext: solution.storybookContext,
    }));
    assert.ok(solutionHtml.includes(`data-presentation-layout="SOLUTION_FOCUS"`));
    if (questionType === "STRUCTURED_RESPONSE") {
      assert.ok(solutionHtml.includes("Mara"));
      assert.ok(solutionHtml.includes("Alter Bahnhof"));
    }
  }
});

test("every productive type uses its controlled Storybook component variant", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 3 });
  for (const questionType of STORYBOOK_EXPERIENCE_QUESTION_TYPES) {
    const question = runtime.moments.find((moment) => moment.kind === "QUESTION" && moment.questionType === questionType);
    assert.ok(question);
    const questionHtml = renderToStaticMarkup(createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide: question.slide,
      slides: runtime.slides,
      slideIndex: runtime.moments.indexOf(question),
      slideLabel: `FRAGE ${question.questionNumber}`,
      theme: runtime.theme,
      displayState,
      storybookContext: question.storybookContext,
    }));
    assert.ok(questionHtml.includes(`data-storybook-question-kind="${questionType}"`), questionType);
    assert.ok(!questionHtml.includes("border-pink-500"), questionType);
    assert.ok(!questionHtml.includes("border-cyan-300"), questionType);
    assert.ok(!questionHtml.includes("border-yellow-300"), questionType);

    const solution = runtime.moments.find((moment) => moment.kind === "SOLUTION" && moment.questionNumber === question.questionNumber);
    assert.ok(solution);
    const solutionHtml = renderToStaticMarkup(createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide: solution.slide,
      slides: runtime.slides,
      slideIndex: runtime.moments.indexOf(solution),
      slideLabel: "AUFLÖSUNG",
      theme: runtime.theme,
      displayState,
      storybookContext: solution.storybookContext,
    }));
    assert.ok(solutionHtml.includes(`data-storybook-question-kind="${questionType}"`), questionType);
    assert.ok(solutionHtml.includes(`data-storybook-phase="SOLUTION"`), questionType);
  }
});

test("Storybook variants do not leak into Neon or Corporate rendering", () => {
  const runtime = buildStorybookExperienceRuntime({ questionCount: 30, personCount: 2 });
  const audioQuestion = runtime.moments.find((moment) => moment.kind === "QUESTION" && moment.questionType === "AUDIO");
  assert.ok(audioQuestion);

  for (const stylePreset of ["NEON", "CORPORATE"] as const) {
    const theme = structuredClone(runtime.theme);
    theme.design.stylePreset = stylePreset;
    const html = renderToStaticMarkup(createElement(PresentationSlideRenderer, {
      quiz: runtime.quiz,
      slide: audioQuestion.slide,
      slides: runtime.slides,
      slideIndex: runtime.moments.indexOf(audioQuestion),
      slideLabel: `FRAGE ${audioQuestion.questionNumber}`,
      theme,
      displayState,
      storybookContext: audioQuestion.storybookContext,
    }));
    assert.ok(!html.includes("data-storybook-question-kind"), stylePreset);
    assert.ok(html.includes("presentation-question-card"), stylePreset);
  }
});
