import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260726160000_add_risk_question_pool_snapshot/migration.sql",
  "utf8",
);
const service = readFileSync(
  "app/quiz/evaluation/evaluation.server.ts",
  "utf8",
);
const actions = readFileSync("app/quiz/actions.ts", "utf8");
const client = readFileSync(
  "app/quiz/[quizId]/auswertung/QuizAuswertungClient.tsx",
  "utf8",
);
const pointFormatter = readFileSync("app/quiz/formatQuizPoints.ts", "utf8");

test("risk pool snapshot is additive and not invented by migration", () => {
  assert.match(schema, /risiko_pool_teamanzahl\s+Int\?/);
  assert.match(schema, /risiko_pool_fixiert_am\s+DateTime\?/);
  assert.match(migration, /ADD COLUMN "risiko_pool_teamanzahl" INTEGER/);
  assert.match(migration, /ADD COLUMN "risiko_pool_fixiert_am" TIMESTAMP\(3\)/);
  assert.doesNotMatch(migration, /UPDATE "pubquiz"\."quiz_fragen"/);
});

test("central recalculation freezes sessions and batch-allocates every risk answer", () => {
  assert.match(service, /allocateRiskQuestionPoints/);
  assert.match(service, /quiz_team_sessions\.count/);
  assert.match(service, /erstellt_am: \{ lte: candidateFixedAt \}/);
  assert.match(
    service,
    /assignment\.punkte_modus === "risikofrage" \|\| requestedIds\.size === 0/,
  );
  assert.doesNotMatch(service, /Decimal\.max\(\s*1/);
});

test("manual status and individual risk points are separate transactional actions", () => {
  const start = actions.indexOf(
    "export async function updateTeamAntwortBewertung",
  );
  const end = actions.indexOf(
    "export async function recalculateQuizEvaluationsAction",
  );
  const moderation = actions.slice(start, end);
  assert.match(moderation, /\| "punkte"/);
  assert.match(moderation, /manuelle_punkte: isRiskQuestion/);
  assert.match(moderation, /existing\.manuelle_punkte/);
  assert.match(moderation, /recalculateQuizQuestionEvaluation\(existing\.quiz_fragen_id, tx\)/);
});

test("quiz copy keeps risk mode but never copies its historical snapshot", () => {
  const start = actions.indexOf("export async function copyQuiz");
  const end = actions.indexOf("export async function getQuizDetails");
  const copy = actions.slice(start, end);
  assert.match(copy, /punkte_modus: quizFrage\.punkte_modus/);
  assert.doesNotMatch(copy, /risiko_pool_teamanzahl:/);
  assert.doesNotMatch(copy, /risiko_pool_fixiert_am:/);
});

test("ranking has no risk formula and evaluation explains the persisted allocation", () => {
  const start = actions.indexOf("export async function getQuizPunktestand");
  const end = actions.indexOf("export async function getZufaelligeSchaetzfrage");
  const ranking = actions.slice(start, end);
  assert.match(ranking, /_sum: \{ vergebene_punkte: true \}/);
  assert.doesNotMatch(ranking, /risiko_pool|risikofrage.*div|correctCount/);
  assert.match(client, /Pool:/);
  assert.match(client, /Verteilung vorläufig/);
  assert.match(client, /formatQuizPoints/);
  assert.match(pointFormatter, /maximumFractionDigits: 2/);
});
