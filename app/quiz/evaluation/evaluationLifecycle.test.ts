import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260725190000_add_quiz_answer_evaluation/migration.sql",
  "utf8",
);
const actions = readFileSync("app/quiz/actions.ts", "utf8");
const evaluationService = readFileSync(
  "app/quiz/evaluation/evaluation.server.ts",
  "utf8",
);
const pointEvaluation = readFileSync(
  "app/quiz/evaluation/evaluateQuestionPoints.ts",
  "utf8",
);

test("schema persists automatic, awarded and auditable manual evaluation data", () => {
  for (const field of [
    "auto_basis_punkte",
    "auto_endpunkte",
    "vergebene_punkte",
    "bewertungsstatus",
    "bewertungsquelle",
    "manuelle_punkte",
    "bewertet_von_user_id",
    "bewertet_am",
  ]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }
  assert.match(schema, /model team_antwort_auswahlen/);
});

test("migration copies legacy selections and preserves binary historical points", () => {
  assert.match(migration, /INSERT INTO "pubquiz"\."team_antwort_auswahlen"/);
  assert.match(migration, /Preserve the former binary historical result/);
  assert.match(migration, /'LEGACY'::"pubquiz"\."QuizAnswerEvaluationSource"/);
  assert.doesNotMatch(migration, /0\.5.*team_antworten/);
});

test("answer writes recalculate while reset restores the automatic result", () => {
  const save = actions.slice(
    actions.indexOf("export async function saveTeamAntwort"),
    actions.indexOf("export async function getQuizFrageAuswertung"),
  );
  const moderation = actions.slice(
    actions.indexOf("export async function updateTeamAntwortBewertung"),
    actions.indexOf("export async function updateQuizFragenStatistiken"),
  );
  assert.match(save, /recalculateQuizQuestionEvaluation\(data\.quizFragenId, tx\)/);
  assert.match(moderation, /vergebene_punkte: existing\.auto_endpunkte/);
  assert.match(moderation, /bewertet_von_user_id: Number\(access\.session\.user\.id\)/);
});

test("ranking sums only persisted Decimal awarded points and keeps zero-point teams", () => {
  const ranking = actions.slice(
    actions.indexOf("export async function getQuizPunktestand"),
    actions.indexOf("export async function getZufaelligeSchaetzfrage"),
  );
  assert.match(ranking, /_sum: \{ vergebene_punkte: true \}/);
  assert.match(ranking, /new Prisma\.Decimal\(0\)/);
  assert.match(ranking, /right\._decimal\.cmp\(left\._decimal\)/);
  assert.doesNotMatch(ranking, /punkte \+=/);
  assert.match(evaluationService, /vergebene_punkte/);
  assert.match(pointEvaluation, /base\.basePoints\.mul\(2\)/);
});
