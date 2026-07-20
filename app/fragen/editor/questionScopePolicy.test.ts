import assert from "node:assert/strict";
import test from "node:test";
import {
  canApproveScopedQuestion,
  canEditScopedQuestion,
  canUseQuestionScope,
  canViewScopedQuestion,
  isQuestionEligibleForQuiz,
  type QuestionActorContext,
  type QuestionScopeAccessContext,
} from "./questionScopePolicy";

const manager: QuestionActorContext = {
  userId: 5,
  assignments: [
    { role: "EVENT_MANAGER", scopeType: "EVENT_SERIES", eventSeriesId: 10 },
    { role: "EDITOR", scopeType: "EVENT_SERIES", eventSeriesId: 20 },
  ],
};
const question = (overrides: Partial<QuestionScopeAccessContext> = {}): QuestionScopeAccessContext => ({
  scope: "EVENT_SERIES",
  eventSeriesIds: [10],
  createdByUserId: 7,
  reviewStatus: "IN_REVIEW",
  isArchived: false,
  isApproved: false,
  ...overrides,
});

test("ADMIN can use global and event-series scopes", () => {
  const admin: QuestionActorContext = {
    userId: 1,
    assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }],
  };
  assert.equal(canUseQuestionScope(admin, "GLOBAL", []), true);
  assert.equal(canUseQuestionScope(admin, "EVENT_SERIES", [10]), true);
});

test("manager can edit and approve only questions fully inside managed series", () => {
  assert.equal(canEditScopedQuestion(manager, question()), true);
  assert.equal(canApproveScopedQuestion(manager, question()), true);
  assert.equal(canApproveScopedQuestion(manager, question({ eventSeriesIds: [10, 20] })), false);
  assert.equal(canApproveScopedQuestion(manager, question({ scope: "GLOBAL" })), false);
});

test("scoped editor can edit own drafts but cannot approve", () => {
  const ownDraft = question({ eventSeriesIds: [20], createdByUserId: 5, reviewStatus: "DRAFT" });
  assert.equal(canEditScopedQuestion(manager, ownDraft), true);
  assert.equal(canApproveScopedQuestion(manager, ownDraft), false);
});

test("global EDITOR can keep own drafts while an actor without global assignment cannot", () => {
  const globalEditor: QuestionActorContext = {
    ...manager,
    assignments: [
      ...manager.assignments,
      { role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null },
    ],
  };
  assert.equal(canViewScopedQuestion(manager, question({ scope: "GLOBAL", eventSeriesIds: [], isApproved: true })), true);
  assert.equal(canViewScopedQuestion(globalEditor, question({ scope: "GLOBAL", eventSeriesIds: [], createdByUserId: 5 })), true);
  assert.equal(canEditScopedQuestion(globalEditor, question({ scope: "GLOBAL", eventSeriesIds: [], createdByUserId: 5, reviewStatus: "DRAFT" })), true);
  assert.equal(canEditScopedQuestion(manager, question({ scope: "GLOBAL", eventSeriesIds: [], createdByUserId: 5, reviewStatus: "DRAFT" })), false);
});

test("global EDITOR can use global scope without receiving event-series rights", () => {
  const editor: QuestionActorContext = {
    userId: 6,
    assignments: [{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }],
  };
  assert.equal(canUseQuestionScope(editor, "GLOBAL", []), true);
  assert.equal(canUseQuestionScope(editor, "EVENT_SERIES", [10]), false);
});

test("quiz eligibility accepts global or matching approved questions only", () => {
  const base = { quizEventSeriesId: 10, isApproved: true, isArchived: false, validUntil: null, now: new Date("2026-07-21") };
  assert.equal(isQuestionEligibleForQuiz({ ...base, scope: "GLOBAL", eventSeriesIds: [] }), true);
  assert.equal(isQuestionEligibleForQuiz({ ...base, scope: "EVENT_SERIES", eventSeriesIds: [10] }), true);
  assert.equal(isQuestionEligibleForQuiz({ ...base, scope: "EVENT_SERIES", eventSeriesIds: [20] }), false);
  assert.equal(isQuestionEligibleForQuiz({ ...base, scope: "GLOBAL", eventSeriesIds: [], isApproved: false }), false);
});
