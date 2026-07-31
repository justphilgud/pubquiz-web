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
const versionMigration = readFileSync(
  "prisma/migrations/20260726120000_add_quiz_answer_evaluation_version/migration.sql",
  "utf8",
);
const evaluationPage = readFileSync(
  "app/quiz/[quizId]/auswertung/page.tsx",
  "utf8",
);

test("schema persists automatic, awarded and auditable manual evaluation data", () => {
  for (const field of [
    "auto_basis_punkte",
    "auto_endpunkte",
    "vergebene_punkte",
    "bewertungsstatus",
    "bewertungsquelle",
    "bewertungs_version",
    "manuelle_punkte",
    "bewertet_von_user_id",
    "bewertet_am",
  ]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }
  assert.match(schema, /model team_antwort_auswahlen/);
  assert.match(versionMigration, /ADD COLUMN "bewertungs_version"/);
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
  assert.match(save, /recalculateQuizAnswerEvaluation\(teamAntwort\.team_antwort_id, tx\)/);
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
  assert.match(evaluationService, /ensureQuizEvaluation/);
  assert.match(evaluationService, /preserveManualOverrides/);
  assert.match(evaluationService, /bewertet_am: answer\.bewertet_am/);
  assert.match(pointEvaluation, /base\.basePoints\.mul\(2\)/);
});

test("read paths backfill only incomplete evaluations", () => {
  for (const functionName of [
    "getQuizAuswertungUebersicht",
    "getQuizAuswertungAlleAntworten",
    "getQuizPunktestand",
  ]) {
    const start = actions.indexOf(`export async function ${functionName}`);
    const nextExport = actions.indexOf("export async function", start + 1);
    const implementation = actions.slice(
      start,
      nextExport === -1 ? undefined : nextExport,
    );
    assert.match(implementation, /ensureQuizEvaluation\(quizId\)/);
    assert.doesNotMatch(implementation, /recalculateQuizEvaluation\(quizId\)/);
  }
});

test("quiz backfill keeps each question in a bounded transaction", () => {
  const start = evaluationService.indexOf(
    "export async function ensureQuizEvaluation",
  );
  const end = evaluationService.indexOf(
    "export async function recalculateQuizEvaluation",
  );
  const implementation = evaluationService.slice(start, end);

  assert.match(
    evaluationService,
    /QUESTION_RECALCULATION_TRANSACTION_TIMEOUT_MS = 30_000/,
  );
  assert.match(
    evaluationService,
    /timeout: QUESTION_RECALCULATION_TRANSACTION_TIMEOUT_MS/,
  );
  assert.match(implementation, /for \(const question of incomplete\)/);
  assert.match(implementation, /recalculateQuizQuestionEvaluation\(/);
  assert.doesNotMatch(implementation, /prisma\.\$transaction/);
});

test("evaluation page authorizes and loads presentation, answers and ranking", () => {
  const implementation = evaluationPage.slice(
    evaluationPage.indexOf("export default async function"),
  );
  const authorization = implementation.indexOf("requireQuizAdmin");
  const presentation = implementation.indexOf("getQuizPraesentation");
  const answers = implementation.indexOf("getQuizAuswertungAlleAntworten");
  const ranking = implementation.indexOf("getQuizPunktestand");

  assert.ok(authorization > -1);
  assert.ok(presentation > authorization);
  assert.ok(answers > presentation);
  assert.ok(ranking > answers);
  assert.match(implementation, /if \(!quiz\)/);
  assert.match(implementation, /<QuizAuswertungClient/);
});

test("evaluation answer loading safely represents missing and structured answers", () => {
  const start = actions.indexOf(
    "export async function getQuizAuswertungAlleAntworten",
  );
  const end = actions.indexOf(
    "export async function updateQuizFragePunkteModus",
  );
  const implementation = actions.slice(start, end);

  assert.match(implementation, /return quizFragen\.flatMap/);
  assert.match(implementation, /return sessions\.map/);
  assert.match(implementation, /antwortfelder/);
  assert.match(implementation, /vorlage: \{ select: \{ code: true \} \}/);
  assert.match(implementation, /!antwort \|\| antwort\.bewertungsstatus === "UNANSWERED"/);
  assert.match(implementation, /bewertungsstatus: antwort\?\.bewertungsstatus \?\? "UNANSWERED"/);
  assert.match(implementation, /vergebenePunkte: Number\(antwort\?\.vergebene_punkte \?\? 0\)/);
});

test("manual recalculation is authorized and preserves overrides", () => {
  const start = actions.indexOf(
    "export async function recalculateQuizEvaluationsAction",
  );
  const end = actions.indexOf(
    "export async function updateQuizFragenStatistiken",
  );
  const action = actions.slice(start, end);
  assert.match(action, /requireQuizAdmin\(quizId\)/);
  assert.match(action, /preserveManualOverrides: true/);
  assert.match(evaluationService, /preserveManualOverrides !== false/);
  assert.match(evaluationService, /manuelle_punkte: null/);
});

test("answer and manual evaluation writes stay in transactional recalculation", () => {
  const save = actions.slice(
    actions.indexOf("export async function saveTeamAntwort"),
    actions.indexOf("export async function getQuizFrageAuswertung"),
  );
  const moderation = actions.slice(
    actions.indexOf("export async function updateTeamAntwortBewertung"),
    actions.indexOf("export async function recalculateQuizEvaluationsAction"),
  );
  assert.match(save, /hasAnswerContentChanged/);
  assert.match(save, /prisma\.\$transaction/);
  assert.match(moderation, /prisma\.\$transaction/);
  assert.match(moderation, /recalculateQuizQuestionEvaluation\(existing\.quiz_fragen_id, tx\)/);
});
