import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAnswerProgress, type ProgressAnswer } from "./answerProgress";

const run = { interaction_run_id: 6, config_snapshot: { interaction: { type: "TEXT", multiline: true, inputMode: "text", placeholder: "" } } };
const time = new Date("2026-09-07T18:00:00Z");
function draft(team: number, text: string | null, runId: number | null = 6): ProgressAnswer {
  return { quiz_team_session_id: team, interaction_run_id: runId, antwort_text: text,
    antwort_id: null, antwortauswahlen: [], antwortfelder: [], draft_updated_at: time,
    aktualisiert_am: time, submissions: [] };
}
const count = (answers: ProgressAnswer[]) => resolveAnswerProgress({ teamSessionIds: [1, 2, 3], run, answers });
function finalize(answer: ProgressAnswer, version = 1) {
  answer.submissions.push({ team_answer_submission_id: version, interaction_run_id: 6,
    submission_version: version, submitted_at: time, payload: { text: answer.antwort_text ?? "" } });
}

test("A/B: saved answers progress 0 → 1 → 2 → 3 for three joined teams", () => {
  const answers: ProgressAnswer[] = [];
  for (let n = 0; n <= 3; n++) {
    assert.equal(count(answers).antwortenEingegangen, n);
    assert.equal(count(answers).teamsAngemeldet, 3);
    if (n < 3) answers.push(draft(n + 1, "Berlin"));
  }
});
test("C/L: Berlin → Hamburg and repeated writes count one team, never requests or revisions", () => {
  const answer = draft(1, "Berlin");
  for (const text of ["Berlin", "Hamburg", "Bonn", "Hamburg"]) {
    answer.antwort_text = text;
    finalize(answer, answer.submissions.length + 1);
    assert.equal(count([answer, answer]).antwortenEingegangen, 1);
    assert.equal(count([answer]).finaleAntworten, 1);
  }
  assert.equal(answer.antwort_text, "Hamburg");
});
test("D: untouched, whitespace and cleared drafts do not count; existing final survives clearing", () => {
  assert.equal(count([draft(1, null), draft(2, "  \n"), draft(3, "")]).antwortenEingegangen, 0);
  const answer = draft(1, "Berlin");
  answer.antwort_text = "";
  assert.equal(count([answer]).antwortenEingegangen, 0);
  answer.antwort_text = "Berlin";
  finalize(answer);
  answer.antwort_text = "";
  assert.equal(count([answer]).antwortenEingegangen, 1);
});
test("E/F: reloaded team, moderator and second moderator derive the same persisted state without writes", () => {
  const answers = [draft(1, "Berlin"), draft(2, "Hamburg")];
  const before = structuredClone(answers);
  const first = count(answers);
  for (let i = 0; i < 4; i++) assert.deepEqual(count(structuredClone(answers)), first);
  assert.deepEqual(answers, before);
  assert.equal(first.antwortenEingegangen, 2);
});
test("G/H/J: hidden/reopened, block-closed and stopped runs preserve counts and effective finals", () => {
  const answers = [draft(1, "Berlin"), draft(2, "Hamburg")];
  for (const state of ["OPEN", "CLOSED", "REVEALED"]) {
    if (state === "CLOSED") answers.forEach((answer) => finalize(answer));
    for (const is_hidden of [true, false]) {
      const result = resolveAnswerProgress({ teamSessionIds: [1, 2, 3], run: { ...run, ...{ state, is_hidden, is_current: false } }, answers });
      assert.equal(result.antwortenEingegangen, 2);
      assert.equal(result.finaleAntworten, state === "OPEN" ? 0 : 2);
    }
  }
});
test("I: questions 6/7 and historical runs are isolated, navigation does not delete answers", () => {
  const answers = [draft(1, "Berlin"), draft(2, "Hamburg"), draft(3, "Bonn", 7), draft(1, "Alt", 5)];
  assert.equal(count(answers).antwortenEingegangen, 2);
  assert.equal(resolveAnswerProgress({ teamSessionIds: [1, 2, 3], run: { ...run, interaction_run_id: 7 }, answers }).antwortenEingegangen, 1);
  assert.equal(count(answers).antwortenEingegangen, 2);
  assert.equal(answers.length, 4);
});
test("K: AP1 reset leaves zero current teams and answers, even stale rows cannot count", () => {
  assert.deepEqual(resolveAnswerProgress({ teamSessionIds: [], run: null, answers: [] }), {
    teamsAngemeldet: 0, antwortenEingegangen: 0, finaleAntworten: 0, prozent: 0, letzteAntwortAt: null,
  });
  assert.equal(resolveAnswerProgress({ teamSessionIds: [], run, answers: [draft(1, "Berlin")] }).antwortenEingegangen, 0);
});
test("legacy content is isolated from run-bound answers and excludes empty rows", () => {
  const result = resolveAnswerProgress({ teamSessionIds: [1, 2, 3], run: null,
    answers: [draft(1, "Berlin", null), draft(2, "", null), draft(3, "other run")] });
  assert.equal(result.antwortenEingegangen, 1);
  assert.equal(result.finaleAntworten, 0);
});
test("choice uses the same contract validator as autosave and finalization", () => {
  const answer = draft(1, null);
  const choiceRun = { ...run, config_snapshot: { interaction: { type: "SINGLE_CHOICE", options: [{ id: 8, label: "A" }] } } };
  const progress = () => resolveAnswerProgress({ teamSessionIds: [1], run: choiceRun, answers: [answer] });
  assert.equal(progress().antwortenEingegangen, 0);
  answer.antwort_id = 8;
  assert.equal(progress().antwortenEingegangen, 1);
  answer.antwort_id = 9;
  assert.throws(progress, /ungültig|ung\\u00fcltig/);
});
test("SUB-INV-11/12: counter is an authorized, uncached, read-only projection; polling rejects obsolete responses", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  const service = read("app/quiz/interaction/answerProgress.server.ts");
  assert.doesNotMatch(service, /\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/);
  assert.doesNotMatch(service, /is_current: true|is_hidden: false|use cache|unstable_cache/);
  assert.match(service, /quiz_id: quizId, quiz_fragen_id: quizFragenId/);
  assert.match(service, /isolationLevel: "RepeatableRead"/);
  const actions = read("app/quiz/[quizId]/praesentation/statusActions.ts");
  assert.match(actions, /requireQuizQuestion\(quizId, quizFragenId\)/);
  assert.match(actions, /return getQuizAnswerProgress\(quizId, quizFragenId\)/);
  const client = read("app/quiz/[quizId]/moderation/ModerationClient.tsx");
  assert.match(client, /await getAntwortStatus\(quizId, questionId\);\s*if \(!active\) return;/);
  assert.match(client, /\[presentationQuestionAssignmentId, quizId, lifecycleState.lifecycleRevision\]/);
  assert.match(client, /Finale Antworten:<\/strong> \{antwortStatus.finaleAntworten\}/);
  const page = read("app/quiz/[quizId]/moderation/page.tsx");
  assert.doesNotMatch(page, /getAntwortStatus\(quizId, null\)/);
});


test("ordering counts only persisted complete permutations and preserves final snapshots", () => {
  const orderRun = { ...run, config_snapshot: { interaction: { type: "ORDER", scoringPolicy: "POSITION", items: [{ id: "a", text: "A" }, { id: "b", text: "B" }] } } };
  const answer = draft(1, null);
  const progress = () => resolveAnswerProgress({ teamSessionIds: [1], run: orderRun, answers: [answer] });
  assert.equal(progress().antwortenEingegangen, 0);
  answer.antwort_text = '["b","a"]';
  assert.equal(progress().antwortenEingegangen, 1);
  answer.submissions.push({ team_answer_submission_id: 1, interaction_run_id: 6, submission_version: 1, submitted_at: time, payload: { itemIds: ["b", "a"] } });
  assert.equal(progress().finaleAntworten, 1);
  answer.antwort_text = '["a","b"]';
  assert.equal(progress().antwortenEingegangen, 1);
  assert.deepEqual(answer.submissions[0].payload, { itemIds: ["b", "a"] });
});
