import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import {
  canEnableFreeAnswer,
  resolveQuizQuestionAnswerMode,
} from "./quizQuestionAnswerMode";

const closedQuestion = {
  templateId: null,
  answers: [{ isCorrect: true }, { isCorrect: false }],
};
const openQuestion = {
  templateId: null,
  answers: [{ isCorrect: true }],
};

test("closed quiz question remains closed without the override", () => {
  const result = resolveQuizQuestionAnswerMode({
    ...closedQuestion,
    allowFreeAnswer: false,
  });

  assert.equal(result.originalMode, "CLOSED");
  assert.equal(result.effectiveMode, "CLOSED");
  assert.equal(result.freeAnswerOverrideActive, false);
});

test("closed quiz question becomes effectively open with the override", () => {
  const result = resolveQuizQuestionAnswerMode({
    ...closedQuestion,
    allowFreeAnswer: true,
  });

  assert.equal(result.originalMode, "CLOSED");
  assert.equal(result.effectiveMode, "OPEN");
  assert.equal(result.freeAnswerOverrideActive, true);
});

test("open quiz question remains open with or without the override", () => {
  for (const allowFreeAnswer of [false, true]) {
    const result = resolveQuizQuestionAnswerMode({
      ...openQuestion,
      allowFreeAnswer,
    });

    assert.equal(result.originalMode, "OPEN");
    assert.equal(result.effectiveMode, "OPEN");
    assert.equal(result.freeAnswerOverrideActive, false);
  }
});

test("template-based open questions remain open", () => {
  const result = resolveQuizQuestionAnswerMode({
    templateId: questionTemplateIds.faceMorph,
    answers: closedQuestion.answers,
    allowFreeAnswer: true,
  });

  assert.equal(result.originalMode, "OPEN");
  assert.equal(result.effectiveMode, "OPEN");
  assert.equal(canEnableFreeAnswer({
    templateId: questionTemplateIds.faceMorph,
    answers: closedQuestion.answers,
  }), false);
});

test("free-answer checkbox is confined to eligible quiz question settings", () => {
  const settings = readFileSync(
    "app/quiz/[quizId]/QuizQuestionSettings.tsx",
    "utf8",
  );

  assert.match(settings, /kannFreieAntwortAktivieren &&/);
  assert.match(settings, /checked=\{freieAntwortErlaubt\}/);
  assert.match(settings, /onFreeAnswerChange/);
  assert.match(settings, /Als offene Frage stellen/);
  assert.match(settings, /Teams sehen keine Antwortmöglichkeiten/);
  assert.match(
    settings,
    /Die ursprünglichen Lösungen bleiben für\s+Auflösung und Bewertung erhalten/,
  );
});

test("free-answer action validates authorization, ownership and the boolean update", () => {
  const actions = readFileSync("app/quiz/actions.ts", "utf8");
  const start = actions.indexOf(
    "export async function updateQuizQuestionFreeAnswerMode",
  );
  const end = actions.indexOf(
    "export async function updateQuizAbschnitteSortierung",
    start,
  );
  const action = actions.slice(start, end);

  assert.match(action, /typeof data\.freieAntwortErlaubt !== "boolean"/);
  assert.match(action, /requireQuizEditor\(data\.quizId\)/);
  assert.match(
    action,
    /requireQuizQuestion\(data\.quizId, data\.quizFragenId\)/,
  );
  assert.match(
    action,
    /data:\s*\{\s*freie_antwort_erlaubt: data\.freieAntwortErlaubt/,
  );
  assert.doesNotMatch(action, /data:\s*data/);
});

test("quiz copy preserves true and false free-answer overrides", () => {
  const actions = readFileSync("app/quiz/actions.ts", "utf8");
  const start = actions.indexOf("export async function copyQuiz");
  const end = actions.indexOf("export async function getQuizDetails", start);
  const copyAction = actions.slice(start, end);

  assert.match(
    copyAction,
    /freie_antwort_erlaubt: quizFrage\.freie_antwort_erlaubt/,
  );
});

test("answer form resolves the effective mode before generic contract rendering", () => {
  const answerClient = readFileSync(
    "app/quiz/[quizId]/antworten/QuizAntwortClient.tsx",
    "utf8",
  );
  const interactionResolver = readFileSync(
    "app/quiz/answerInteraction.ts",
    "utf8",
  );
  const overrideBranch = interactionResolver.indexOf(
    "freeAnswerOverrideActive && allowedTypes.includes(\"TEXT\")",
  );
  const answerFieldBranch = interactionResolver.indexOf(
    "input.answerFields.length > 0",
  );

  assert.ok(overrideBranch >= 0);
  assert.ok(overrideBranch < answerFieldBranch);
  assert.match(answerClient, /interaction=\{frage\.interaction\}/);
  assert.match(answerClient, /<GenericAnswerRenderer/);
  assert.doesNotMatch(answerClient, /templateId === "multiple_choice"/);
});

test("server rejects selection answers for an effectively open question", () => {
  const actions = readFileSync("app/quiz/actions.ts", "utf8");
  const start = actions.indexOf("export async function saveTeamAntwort");
  const end = actions.indexOf(
    "export async function getQuizFrageAuswertung",
    start,
  );
  const saveAction = actions.slice(start, end);

  assert.match(
    saveAction,
    /answerMode\.effectiveMode === "OPEN"[\s\S]*data\.antwortId !== null/,
  );
  assert.match(saveAction, /freie Textantwort/);
});

test("presentation hides choices by effective mode but keeps solution answers", () => {
  const renderer = readFileSync(
    "app/rendering/presentation/PresentationSlideRenderer.tsx",
    "utf8",
  );

  assert.match(renderer, /effektiver_antwortmodus === "OPEN"\) return false/);
  assert.match(
    renderer,
    /const richtigeAntworten = antworten\.filter\(\(antwort\) => antwort\.ist_richtig\)/,
  );
});

test("moderation preview follows the effective mode for question choices", () => {
  const preview = readFileSync(
    "app/rendering/presentation/PresentationSlideRenderer.tsx",
    "utf8",
  );

  assert.match(
    preview,
    /effektiver_antwortmodus === "CLOSED"/,
  );
  assert.match(preview, /\{hatAntwortmoeglichkeiten && \(/);
  assert.match(preview, /frage\.antwort_reihenfolge/);
});

test("evaluation auto-grades only exact effective open answers", () => {
  const actions = readFileSync("app/quiz/actions.ts", "utf8");
  const evaluation = readFileSync(
    "app/quiz/evaluation/evaluateBaseAnswer.ts",
    "utf8",
  );

  assert.match(actions, /recalculateQuizQuestionEvaluation/);
  assert.match(evaluation, /input\.effectiveAnswerMode !== "CLOSED"/);
  assert.match(evaluation, /strategy: "EXACT_OPEN_ANSWER"/);
  assert.match(evaluation, /status: "REVIEW_REQUIRED"/);
  assert.match(actions, /richtigeAntwort: richtigeAntworten \|\| offeneMusterloesung/);
});

test("migration keeps existing quiz assignments disabled by default", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync(
    "prisma/migrations/20260725160000_add_quiz_question_free_answer_override/migration.sql",
    "utf8",
  );

  assert.match(schema, /freie_antwort_erlaubt\s+Boolean\s+@default\(false\)/);
  assert.match(
    migration,
    /"freie_antwort_erlaubt" BOOLEAN NOT NULL DEFAULT false/,
  );
});
