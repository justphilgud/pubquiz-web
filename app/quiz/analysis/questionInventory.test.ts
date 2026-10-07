import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisQuestion, QuizAnalysisSnapshot } from "./quizAnalysisReader";
import { summarizeQuestionInventory } from "./questionInventory";

function question(id: number, patch: Partial<AnalysisQuestion> = {}): AnalysisQuestion {
  return { id, text: "Test", source: null, reviewStatus: "DRAFT", archived: false,
    approved: false, incomplete: false, template: null, sourceTemplate: null,
    canonicalTemplate: "standard", solutions: [], categories: [], media: [], answers: [], answerFields: [],
    scope: "GLOBAL", eventSeriesIds: [], difficulty: null, validUntil: null, reviewFrom: null,
    templateConfig: null, quizUsages: [], ...patch };
}

test("status matrix distinguishes workflow, legacy approval flag and archive independently", () => {
  const questions = [question(1), question(2, { reviewStatus: "APPROVED", approved: true }),
    question(3, { reviewStatus: "APPROVED", approved: false, archived: true }),
    question(4, { reviewStatus: "IN_REVIEW" }), question(5, { reviewStatus: "CHANGES_REQUESTED" })];
  const snapshot: QuizAnalysisSnapshot = { capturedAt: "2026-10-07", questions, quizzes: [], templates: [], categories: [], eventSeries: [] };
  const before = structuredClone(snapshot);
  const result = summarizeQuestionInventory(snapshot);
  assert.equal(result.total, 5);
  assert.equal(result.reviewStatuses.APPROVED, 2);
  assert.equal(result.statusMatrix["APPROVED|ARCHIVED|NOT_APPROVED_FLAG"], 1);
  assert.equal(result.statusMatrix["DRAFT|NOT_ARCHIVED|NOT_APPROVED_FLAG"], 1);
  assert.deepEqual(snapshot, before);
});

test("multiple categories, zero-use categories, solution media and repeated assignments do not inflate question totals", () => {
  const snapshot: QuizAnalysisSnapshot = { capturedAt: "2026-10-07", quizzes: [], templates: [], eventSeries: [],
    categories: [{ id: 1, name: "Sport", status: "ACTIVE" }, { id: 2, name: "Tennis", status: "ACTIVE" }, { id: 3, name: "Leer", status: "ACTIVE" }],
    questions: [question(1, { categories: [{ id: 1, name: "Sport", status: "ACTIVE" }, { id: 2, name: "Tennis", status: "ACTIVE" }],
      media: [{ id: 1, type: "Bild", owner: "ANSWER", answerId: 1, answerFieldId: null, position: 1, file: "solution.png", slot: "answer_image" }],
      quizUsages: [1, 2].map(quizId => ({ quizId, title: "Test", archived: false, eventSeriesId: 1, assignmentId: quizId, sectionId: null, position: 1 })) }), question(2)] };
  const result = summarizeQuestionInventory(snapshot);
  assert.equal(result.used, 1);
  assert.equal(result.unused, 1);
  assert.equal(result.uncategorized, 1);
  assert.equal(result.withMedia, 1);
  assert.equal(result.mediaOwners.ANSWER, 1);
  assert.deepEqual(result.categories.map(c => c.questions), [1, 1, 0]);
});
