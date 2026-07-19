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
  globalRole: "EDITOR",
  userId: 5,
  assignments: new Map([[10, "EVENT_MANAGER"], [20, "EDITOR"]]),
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
  const admin = { globalRole: "ADMIN", userId: 1, assignments: new Map() };
  assert.equal(canUseQuestionScope(admin, "GLOBAL", []), true);
  assert.equal(canUseQuestionScope(admin, "EVENT_SERIES", [10]), true);
});

test("manager can edit and approve only questions fully inside managed series", () => {
  assert.equal(canEditScopedQuestion(manager, question()), true);
  assert.equal(canApproveScopedQuestion(manager, question()), true);
  assert.equal(canApproveScopedQuestion(manager, question({ eventSeriesIds: [10, 20] })), false);
  assert.equal(canApproveScopedQuestion(manager, question({ scope: "GLOBAL" })), false);
});

test("editor can edit own drafts but cannot approve", () => {
  const ownDraft = question({ eventSeriesIds: [20], createdByUserId: 5, reviewStatus: "DRAFT" });
  assert.equal(canEditScopedQuestion(manager, ownDraft), true);
  assert.equal(canApproveScopedQuestion(manager, ownDraft), false);
});

test("global approved questions are visible but global drafts remain compatible for their creator", () => {
  assert.equal(canViewScopedQuestion(manager, question({ scope: "GLOBAL", eventSeriesIds: [], isApproved: true })), true);
  assert.equal(canViewScopedQuestion(manager, question({ scope: "GLOBAL", eventSeriesIds: [], createdByUserId: 5 })), true);
  assert.equal(canEditScopedQuestion(manager, question({ scope: "GLOBAL", eventSeriesIds: [], createdByUserId: 5, reviewStatus: "DRAFT" })), true);
});

test("quiz eligibility accepts global or matching approved questions only", () => {
  const base = { quizEventSeriesId: 10, isApproved: true, isArchived: false, validUntil: null, now: new Date("2026-07-21") };
  assert.equal(isQuestionEligibleForQuiz({ ...base, scope: "GLOBAL", eventSeriesIds: [] }), true);
  assert.equal(isQuestionEligibleForQuiz({ ...base, scope: "EVENT_SERIES", eventSeriesIds: [10] }), true);
  assert.equal(isQuestionEligibleForQuiz({ ...base, scope: "EVENT_SERIES", eventSeriesIds: [20] }), false);
  assert.equal(isQuestionEligibleForQuiz({ ...base, scope: "GLOBAL", eventSeriesIds: [], isApproved: false }), false);
});
