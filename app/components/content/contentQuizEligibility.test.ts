import assert from "node:assert/strict";
import test from "node:test";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import {
  getAssignableQuestionQuizIds,
  getAssignableStoryQuizIds,
  getUnassignedQuizIds,
} from "./contentQuizEligibility";

const quizzes = [
  { quizId: 100, eventSeriesId: 10 },
  { quizId: 200, eventSeriesId: 20 },
];
const now = new Date("2026-08-11T00:00:00.000Z");

test("approved global questions are assignable to quizzes of every manageable series", () => {
  assert.deepEqual(getAssignableQuestionQuizIds({
    scope: "GLOBAL",
    eventSeriesIds: [],
    createdByUserId: 1,
    reviewStatus: "APPROVED",
    isApproved: true,
    isArchived: false,
    validUntil: null,
  }, quizzes, now), [100, 200]);
});

test("event-series questions are assignable only to the matching series", () => {
  assert.deepEqual(getAssignableQuestionQuizIds({
    scope: "EVENT_SERIES",
    eventSeriesIds: [10],
    createdByUserId: 1,
    reviewStatus: "APPROVED",
    isApproved: true,
    isArchived: false,
    validUntil: null,
  }, quizzes, now), [100]);
});

test("draft, archived, and expired questions are not assignable", () => {
  const base = {
    scope: "GLOBAL" as const,
    eventSeriesIds: [],
    createdByUserId: 1,
    reviewStatus: "DRAFT" as const,
    isApproved: false,
    isArchived: false,
    validUntil: null,
  };
  assert.deepEqual(getAssignableQuestionQuizIds(base, quizzes, now), []);
  assert.deepEqual(getAssignableQuestionQuizIds({ ...base, isApproved: true, isArchived: true }, quizzes, now), []);
  assert.deepEqual(getAssignableQuestionQuizIds({ ...base, isApproved: true, validUntil: new Date("2026-08-10T00:00:00.000Z") }, quizzes, now), []);
});

const manager: AuthorizationActor = {
  userId: 7,
  assignments: [{ eventSeriesId: 10, role: "EVENT_MANAGER", scopeType: "EVENT_SERIES" }],
};

test("story elements use the same global, event-series, status, and quiz-scope rules as server assignment", () => {
  const base = {
    eventSeriesId: null,
    quizId: null,
    quizEventSeriesId: null,
    createdByUserId: 7,
    status: "ACTIVE" as const,
  };
  assert.deepEqual(getAssignableStoryQuizIds(manager, { ...base, scope: "GLOBAL" }, quizzes), [100]);
  assert.deepEqual(getAssignableStoryQuizIds(manager, { ...base, scope: "EVENT_SERIES", eventSeriesId: 10 }, quizzes), [100]);
  assert.deepEqual(getAssignableStoryQuizIds(manager, { ...base, scope: "EVENT_SERIES", eventSeriesId: 20 }, quizzes), []);
  assert.deepEqual(getAssignableStoryQuizIds(manager, { ...base, scope: "EVENT_SERIES", eventSeriesId: 10, status: "ARCHIVED" }, quizzes), []);
  assert.deepEqual(getAssignableStoryQuizIds(manager, { ...base, scope: "QUIZ", quizId: 100, quizEventSeriesId: 10 }, quizzes), [100]);
});

test("already assigned quizzes are removed from the available assignment set", () => {
  assert.deepEqual(getUnassignedQuizIds([100, 200], [100]), [200]);
  assert.deepEqual(getUnassignedQuizIds([100], [100]), []);
});
