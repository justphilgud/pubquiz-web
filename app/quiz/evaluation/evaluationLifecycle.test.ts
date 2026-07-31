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
const evaluationClient = readFileSync(
  "app/quiz/[quizId]/auswertung/QuizAuswertungClient.tsx",
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
    actions.indexOf("async function loadQuizPunktestand"),
    actions.indexOf("export async function getQuizPunktestand"),
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

test("read paths never backfill evaluations", () => {
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
    assert.doesNotMatch(implementation, /ensureQuizEvaluation\(quizId\)/);
    assert.doesNotMatch(implementation, /recalculateQuizEvaluation\(quizId\)/);
    assert.doesNotMatch(
      implementation,
      /processQuizEvaluationBackfillBatch\(quizId/,
    );
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

test("evaluation page uses one authorized parallel page-data loader", () => {
  const loaderStart = actions.indexOf(
    "export async function getQuizAuswertungPageData",
  );
  const loaderEnd = actions.indexOf(
    "export async function getZufaelligeSchaetzfrage",
    loaderStart,
  );
  const loader = actions.slice(loaderStart, loaderEnd);

  assert.match(loader, /await requireQuizAdmin\(quizId\)/);
  assert.match(loader, /await Promise\.all\(/);
  assert.match(loader, /loadQuizAuswertungAlleAntworten\(quizId\)/);
  assert.match(loader, /loadQuizPunktestand\(quizId\)/);
  assert.match(loader, /getQuizEvaluationBackfillStatus\(quizId\)/);
  assert.match(evaluationPage, /getQuizAuswertungPageData/);
  assert.doesNotMatch(evaluationPage, /getQuizPraesentation/);
  assert.match(evaluationPage, /if \(!quiz\)/);
  assert.match(evaluationPage, /backfillStatus=\{backfillStatus\}/);
});

test("evaluation answer loading safely represents missing and structured answers", () => {
  const start = actions.indexOf(
    "async function loadQuizAuswertungAlleAntworten",
  );
  const end = actions.indexOf(
    "export async function getQuizAuswertungAlleAntworten",
    start,
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

test("backfill action authorizes before processing a bounded batch", () => {
  const start = actions.indexOf(
    "export async function continueQuizEvaluationBackfillAction",
  );
  const end = actions.indexOf(
    "export async function updateQuizFragenStatistiken",
    start,
  );
  const action = actions.slice(start, end);
  const authorization = action.indexOf("requireQuizAdmin(quizId)");
  const processing = action.indexOf(
    "processQuizEvaluationBackfillBatch(quizId",
  );

  assert.ok(authorization > -1);
  assert.ok(processing > authorization);
  assert.match(action, /revalidatePath\(`\/quiz\/\$\{quizId\}\/auswertung`\)/);
  assert.match(
    evaluationService,
    /QUIZ_EVALUATION_BACKFILL_BATCH_QUESTION_LIMIT/,
  );
  assert.match(evaluationService, /preserveManualOverrides: true/);
});

test("parallel backfill starts update existing unique answers instead of inserting", () => {
  const start = evaluationService.indexOf(
    "export async function processQuizEvaluationBackfillBatch",
  );
  const end = evaluationService.indexOf(
    "export async function recalculateQuizEvaluation",
    start,
  );
  const batch = evaluationService.slice(start, end);

  assert.doesNotMatch(batch, /\.create(?:Many)?\(/);
  assert.match(evaluationService, /team_antworten\.updateMany\(/);
  assert.match(
    schema,
    /@@unique\(\[quiz_fragen_id, quiz_team_session_id\], map: "uq_team_antwort_pro_frage"\)/,
  );
  assert.match(evaluationService, /bewertungsquelle: answer\.bewertungsquelle/);
  assert.match(evaluationService, /bewertet_am: answer\.bewertet_am/);
});

test("incomplete evaluation state marks existing results and ranking as provisional", () => {
  assert.match(
    evaluationClient,
    /Vorhandene Ergebnisse werden bereits angezeigt/,
  );
  assert.match(evaluationClient, /Punktestand \(vorläufig\)/);
  assert.match(evaluationClient, /Berechnung fortsetzen/);
});

test("answer loading uses two parallel queries without follow-up field lookups", () => {
  const start = actions.indexOf(
    "async function loadQuizAuswertungAlleAntworten",
  );
  const end = actions.indexOf(
    "export async function getQuizAuswertungAlleAntworten",
    start,
  );
  const implementation = actions.slice(start, end);

  assert.match(implementation, /await Promise\.all\(/);
  assert.match(implementation, /antwortfelder: true/);
  assert.doesNotMatch(implementation, /team_antwortfelder\.findMany/);
  assert.doesNotMatch(implementation, /frage_antwortfelder\.findMany/);
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
