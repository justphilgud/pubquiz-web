import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertEvaluationRevision, contentRevision, evaluationRevision } from "./evaluationRevision";
import { pollEvaluation } from "./pollEvaluation";

const read = (path: string) => readFileSync(`app/quiz/${path}`, "utf8");
const actions = read("actions.ts");
const mutation = actions.slice(actions.indexOf("export async function updateTeamAntwortBewertung"), actions.indexOf("export async function recalculateQuizEvaluationsAction"));
const client = read("[quizId]/auswertung/QuizAuswertungClient.tsx");
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test("SCORE-INV-01/08/11: revision guards ten sequential decisions against stale windows and duplicate requests", () => {
  let stored = { team_antwort_id: 1, vergebene_punkte: 0, bewertungsstatus: "REVIEW_REQUIRED", bewertet_am: new Date(0) };
  const points = [1, 0, 0.5, 1, 0, 1, 0.25, 0, 1, 0.5];
  for (const [index, value] of points.entries()) {
    const old = evaluationRevision(stored);
    assertEvaluationRevision(old, evaluationRevision(stored));
    stored = { ...stored, vergebene_punkte: value, bewertungsstatus: value === 1 ? "CORRECT" : value === 0 ? "WRONG" : "PARTIAL", bewertet_am: new Date(index + 1) };
    assert.throws(() => assertEvaluationRevision(old, evaluationRevision(stored)), /inzwischen/);
    assert.equal(stored.vergebene_punkte, value);
  }
});

for (const field of ["vergebene_punkte", "auto_endpunkte", "bewertungsstatus", "ist_skurril", "interaction_run_id", "draft_revision"]) {
  test(`revision detects ${field} without a manual timestamp`, () => {
    assert.notEqual(evaluationRevision({ [field]: 0 }), evaluationRevision({ [field]: 1 }));
  });
}

test("equal totals cannot hide changes to individual ratings", () => {
  assert.notEqual(contentRevision([1, 0]), contentRevision([0, 1]));
  assert.equal(evaluationRevision({ unrelated: "a" }), evaluationRevision({ unrelated: "b" }));
});

test("SCORE-INV-02/10: polling applies committed results without overlapping requests", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let complete!: (value: number) => void;
  let calls = 0;
  const values: number[] = [];
  const stop = pollEvaluation(() => { calls++; return new Promise<number>((resolve) => { complete = resolve; }); }, (value) => values.push(value));
  t.mock.timers.tick(10000);
  assert.equal(calls, 1);
  complete(1); await flush();
  assert.deepEqual(values, [1]);
  t.mock.timers.tick(2000);
  assert.equal(calls, 2);
  complete(0.5); await flush();
  assert.deepEqual(values, [1, 0.5]);
  stop();
});

test("SCORE-INV-09: read failure retains the last confirmed value and retries", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let visible = 1;
  let errors = 0;
  const stop = pollEvaluation(async () => { if (++calls === 1) throw Error("offline"); return 0.5; }, (value) => { visible = value; }, () => { errors++; });
  await flush();
  assert.equal(visible, 1); assert.equal(errors, 1);
  t.mock.timers.tick(2000); await flush();
  assert.equal(visible, 0.5);
  stop();
});

test("disposed views cannot receive a late old response", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let complete!: (value: number) => void;
  const values: number[] = [];
  const stop = pollEvaluation(() => new Promise<number>((resolve) => { complete = resolve; }), (value) => values.push(value));
  stop(); complete(99); await flush(); t.mock.timers.tick(10000);
  assert.deepEqual(values, []);
});

test("B08: manual evaluation never calls the global admin statistics redirect", () => {
  assert.match(mutation, /requireQuizAdmin/);
  assert.doesNotMatch(mutation, /updateQuizFragenStatistiken|redirect\(|router\./);
  assert.match(mutation, /recalculateQuizQuestionEvaluation/);
  assert.match(mutation, /success: false/);
  assert.ok(mutation.indexOf("FOR UPDATE") < mutation.indexOf("requireQuizTeamAnswer"));
  assert.ok(mutation.indexOf("assertEvaluationRevision") < mutation.indexOf("tx.team_antworten.update"));
});

test("SCORE-INV-03/04/08: rating controls preserve route, selection and prevent double submit", () => {
  assert.doesNotMatch(client, /router\.(push|replace)|location.reload|<form/);
  assert.match(client, /ratingLock.current \|\| ratingPending/);
  assert.match(client, /setAusgewaehltesTeam/);
  const controls = client.slice(client.indexOf("Automatisch: <strong>"));
  for (const button of controls.matchAll(/<button\b[\s\S]*?>/g)) assert.match(button[0], /type="button"/);
  assert.match(client, /role="alert"/);
  assert.match(client, /router.refresh\(\)/);
});

test("SCORE-INV-05/06/12: evaluation and read refresh do not mutate lifecycle or submissions", () => {
  assert.doesNotMatch(mutation, /quiz_praesentation_status|quiz_interaction_runs|submissions\.(create|update|delete)|lockQuizLifecycle/);
  const reads = actions.slice(actions.indexOf("async function loadQuizEvaluationRevision"), actions.indexOf("export async function getZufaelligeSchaetzfrage"));
  assert.doesNotMatch(reads, /\.(create|update|upsert|delete)\(|recalculate/);
  assert.match(reads, /RepeatableRead/);
});

test("SCORE-INV-07: matrix details and standings follow the refreshed projection", () => {
  assert.match(read("evaluation/TeamQuestionEvaluationMatrix.tsx"), /selection=\{currentSelection\}/);
  for (const path of ["[quizId]/moderation/ModerationClient.tsx", "[quizId]/praesentation/QuizPraesentationPlayer.tsx"]) {
    const source = read(path);
    assert.match(source, /return pollEvaluation\(/);
    assert.match(source, /getPraesentationAudienceZwischenstand/);
  }
});
