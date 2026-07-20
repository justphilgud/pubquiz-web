import assert from "node:assert/strict";
import test from "node:test";
import {
  hasEventSeriesCapability,
  isEventSeriesAssignmentRole,
  removingAssignmentLeavesNoEventManager,
} from "./eventSeriesAccessPolicy";

test("ADMIN has global event-series access", () => {
  for (const capability of [
    "VIEW",
    "EDIT",
    "MANAGE_QUIZZES",
    "CONTROL_LIVE",
    "CREATE_QUESTION",
    "REVIEW_QUESTION",
    "MANAGE_MEMBERS",
    "CHANGE_ARCHIVE_STATE",
  ] as const) {
    assert.equal(
      hasEventSeriesCapability({ globalRole: "ADMIN", assignmentRole: null, capability }),
      true,
    );
  }
});

test("EVENT_MANAGER is limited to assigned operational capabilities", () => {
  assert.equal(hasEventSeriesCapability({ globalRole: "USER", assignmentRole: "EVENT_MANAGER", capability: "EDIT" }), true);
  assert.equal(hasEventSeriesCapability({ globalRole: "USER", assignmentRole: "EVENT_MANAGER", capability: "REVIEW_QUESTION" }), true);
  assert.equal(hasEventSeriesCapability({ globalRole: "USER", assignmentRole: "EVENT_MANAGER", capability: "MANAGE_MEMBERS" }), false);
  assert.equal(hasEventSeriesCapability({ globalRole: "USER", assignmentRole: "EVENT_MANAGER", capability: "CHANGE_ARCHIVE_STATE" }), false);
});

test("EVENT_EDITOR receives scoped question rights without quiz or review rights", () => {
  assert.equal(hasEventSeriesCapability({ globalRole: "USER", assignmentRole: "EVENT_EDITOR", capability: "VIEW" }), true);
  assert.equal(hasEventSeriesCapability({ globalRole: "USER", assignmentRole: "EVENT_EDITOR", capability: "CREATE_QUESTION" }), true);
  assert.equal(hasEventSeriesCapability({ globalRole: "USER", assignmentRole: "EVENT_EDITOR", capability: "MANAGE_QUIZZES" }), false);
  assert.equal(hasEventSeriesCapability({ globalRole: "USER", assignmentRole: "EVENT_EDITOR", capability: "REVIEW_QUESTION" }), false);
});

test("global EDITOR receives no event-series rights without a membership", () => {
  assert.equal(hasEventSeriesCapability({ globalRole: "EDITOR", assignmentRole: null, capability: "VIEW" }), false);
  assert.equal(hasEventSeriesCapability({ globalRole: "EDITOR", assignmentRole: null, capability: "EDIT" }), false);
});

test("assignment roles are closed and last-manager warning is deterministic", () => {
  assert.equal(isEventSeriesAssignmentRole("EVENT_MANAGER"), true);
  assert.equal(isEventSeriesAssignmentRole("EVENT_EDITOR"), true);
  assert.equal(isEventSeriesAssignmentRole("EDITOR"), false);
  assert.equal(isEventSeriesAssignmentRole("ADMIN"), false);
  assert.equal(removingAssignmentLeavesNoEventManager([{ role: "EVENT_MANAGER" }], "EVENT_MANAGER"), true);
  assert.equal(removingAssignmentLeavesNoEventManager([{ role: "EVENT_MANAGER" }, { role: "EVENT_MANAGER" }], "EVENT_MANAGER"), false);
});
