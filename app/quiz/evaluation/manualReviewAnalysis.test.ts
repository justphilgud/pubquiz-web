import assert from "node:assert/strict";
import test from "node:test";
import snapshot from "@/docs/reports/assets/lovd-november-ap5/aggregate.json";
import { analyzeManualReview, type ManualReviewAggregate } from "./manualReviewAnalysis";

const question = (changes: Partial<ManualReviewAggregate> = {}): ManualReviewAggregate => ({
  id: 1, position: 1, section: 1, template: "standard", points_mode: "standard",
  allow_free: false, field_count: 0, options: [{ isCorrect: true }], played: true,
  cells: 4, answered: 4, unsubmitted_drafts: 0, legacy: 0, unanswered: 0, pending: 0,
  automatic_correct: 0, filtered: 4, manual: 3, unresolved: 1,
  groups: [{ members: 4, manualOrReview: 4, unresolved: 1, conflict: false }], ...changes,
});

test("current unresolved work is separate from completed manual decisions and visible wrong answers", () => {
  const { totals } = analyzeManualReview([question()]);
  assert.equal(totals.manualEvidence, 4);
  assert.equal(totals.freeTextSavings, 3);
  assert.equal(totals.unresolved, 1);
  assert.equal(totals.unresolvedSavings, 0);
  const wrongOnly = analyzeManualReview([question({ manual: 0, unresolved: 0, groups: [{ members: 4, manualOrReview: 0, unresolved: 0, conflict: false }] })]);
  assert.equal(wrongOnly.totals.textSavings, 3);
  assert.equal(wrongOnly.totals.evidenceSavings, 0);
});

test("default, open and optional incorrect filters retain their existing meanings", () => {
  const closed = question({ options: [{ isCorrect: true }, { isCorrect: false }] });
  assert.equal(analyzeManualReview([closed]).totals.manualEvidence, 0);
  assert.equal(analyzeManualReview([closed]).totals.defaultVisible, 4);
  assert.equal(analyzeManualReview([{ ...closed, allow_free: true }]).totals.manualEvidence, 4);
  assert.equal(analyzeManualReview([question({ played: false })]).totals.defaultVisible, 0);
  assert.equal(analyzeManualReview([question({ filtered: 2, unanswered: 1 })]).totals.incorrectVisible, 3);
});

test("groups never cross question assignments, conflicts never produce savings", () => {
  assert.equal(analyzeManualReview([question(), question({ id: 2 })]).totals.freeTextSavings, 6);
  const result = analyzeManualReview([question({ groups: [{ members: 4, manualOrReview: 4, unresolved: 1, conflict: true }] })]);
  assert.equal(result.totals.freeTextSavings, 0);
  assert.equal(result.totals.conflicts, 1);
});

test("creative, poll, controlled and context-dependent cases cannot inflate free-text estimates", () => {
  assert.equal(analyzeManualReview([question({ template: "meme_beschriften" })]).questions.length, 0);
  for (const changes of [{ template: "pixelbild" }, { template: "fakten_land" }, { template: "fakten_jahr" }, { points_mode: "risikofrage" }]) {
    assert.equal(analyzeManualReview([question(changes)]).totals.freeTextSavings, 0);
  }
});

test("recorded twelve-team aggregate reconciles all fifty assignments without participant data", () => {
  assert.equal(snapshot.length, 50);
  assert.equal(snapshot.reduce((n, q) => n + q.cells, 0), 600);
  for (const q of snapshot) {
    assert.equal(q.cells, 12);
    assert.equal(q.answered + q.unanswered, q.cells);
    assert.equal(q.filtered + q.automatic_correct, q.answered);
  }
  const { totals, questions } = analyzeManualReview(snapshot);
  assert.deepEqual(totals, { cells: 588, defaultVisible: 588, incorrectVisible: 316, openAnsweredVisible: 126,
    unanswered: 29, pending: 0, manual: 112, unresolved: 1, manualEvidence: 113,
    textSavings: 9, freeTextEvidence: 88, structuredManual: 44, evidenceSavings: 8, freeTextSavings: 6, unresolvedSavings: 0, conflicts: 0 });
  assert.deepEqual(questions.filter(q => q.unresolved).map(q => q.id), [431]);
  assert.deepEqual(questions.filter(q => q.freeTextSavings).map(q => [q.id, q.freeTextSavings]), [[469, 4], [453, 1], [480, 1]]);
});
