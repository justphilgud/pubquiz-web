import assert from "node:assert/strict";
import test from "node:test";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import {
  hasEventSeriesCapability,
  isEventSeriesAssignmentRole,
} from "./eventSeriesAccessPolicy";

const actor = (
  assignments: AuthorizationActor["assignments"],
): AuthorizationActor => ({ userId: 5, assignments });

test("ADMIN has global event-series access", () => {
  const admin = actor([{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }]);
  for (const capability of [
    "VIEW", "EDIT", "MANAGE_QUIZZES", "CONTROL_LIVE", "CREATE_QUESTION",
    "REVIEW_QUESTION", "MANAGE_MEMBERS", "CHANGE_ARCHIVE_STATE",
  ] as const) {
    assert.equal(hasEventSeriesCapability({ actor: admin, eventSeriesId: 10, capability }), true);
  }
});

test("EVENT_MANAGER is limited to its assigned series", () => {
  const manager = actor([{ role: "EVENT_MANAGER", scopeType: "EVENT_SERIES", eventSeriesId: 10 }]);
  assert.equal(hasEventSeriesCapability({ actor: manager, eventSeriesId: 10, capability: "EDIT" }), true);
  assert.equal(hasEventSeriesCapability({ actor: manager, eventSeriesId: 10, capability: "REVIEW_QUESTION" }), true);
  assert.equal(hasEventSeriesCapability({ actor: manager, eventSeriesId: 10, capability: "MANAGE_MEMBERS" }), false);
  assert.equal(hasEventSeriesCapability({ actor: manager, eventSeriesId: 20, capability: "VIEW" }), false);
});

test("scoped EDITOR receives question rights without quiz or review rights", () => {
  const editor = actor([{ role: "EDITOR", scopeType: "EVENT_SERIES", eventSeriesId: 10 }]);
  assert.equal(hasEventSeriesCapability({ actor: editor, eventSeriesId: 10, capability: "VIEW" }), true);
  assert.equal(hasEventSeriesCapability({ actor: editor, eventSeriesId: 10, capability: "CREATE_QUESTION" }), true);
  assert.equal(hasEventSeriesCapability({ actor: editor, eventSeriesId: 10, capability: "MANAGE_QUIZZES" }), false);
  assert.equal(hasEventSeriesCapability({ actor: editor, eventSeriesId: 10, capability: "REVIEW_QUESTION" }), false);
});

test("global EDITOR receives no event-series rights without a scoped assignment", () => {
  const editor = actor([{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }]);
  assert.equal(hasEventSeriesCapability({ actor: editor, eventSeriesId: 10, capability: "VIEW" }), false);
});

test("event-series roles are closed", () => {
  assert.equal(isEventSeriesAssignmentRole("EVENT_MANAGER"), true);
  assert.equal(isEventSeriesAssignmentRole("EDITOR"), true);
  assert.equal(isEventSeriesAssignmentRole("EVENT_EDITOR"), false);
  assert.equal(isEventSeriesAssignmentRole("ADMIN"), false);
});
