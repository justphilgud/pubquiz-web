import assert from "node:assert/strict";
import test from "node:test";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { canManageEventSeries, getQuestionEditorCapabilities } from "./permissions";

const admin: AuthorizationActor = {
  userId: 1,
  assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }],
};
const editor: AuthorizationActor = {
  userId: 2,
  assignments: [{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }],
};
const user: AuthorizationActor = { userId: 3, assignments: [] };

test("admins can save and approve changes to an already approved question", () => {
  const capabilities = getQuestionEditorCapabilities(admin, {
    createdByUserId: 2,
    reviewStatus: "APPROVED",
    isArchived: false,
  });
  assert.equal(capabilities.canSaveDraft, true);
  assert.equal(capabilities.canApproveQuestion, true);
  assert.equal(capabilities.canManageCategories, true);
  assert.equal(capabilities.canCloneQuestion, true);
});

test("global editors cannot manage categories or clone another editor's question", () => {
  const capabilities = getQuestionEditorCapabilities(editor, {
    createdByUserId: 3,
    reviewStatus: "DRAFT",
    isArchived: false,
  });
  assert.equal(capabilities.canManageCategories, false);
  assert.equal(capabilities.canCloneQuestion, false);
});

test("admins and scoped managers expose event-series navigation", () => {
  const manager: AuthorizationActor = {
    userId: 4,
    assignments: [{ role: "EVENT_MANAGER", scopeType: "EVENT_SERIES", eventSeriesId: 10 }],
  };
  assert.equal(canManageEventSeries(admin), true);
  assert.equal(canManageEventSeries(editor), false);
  assert.equal(canManageEventSeries(manager), true);
  assert.equal(canManageEventSeries(user), false);
});
