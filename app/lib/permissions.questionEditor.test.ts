import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "next-auth";
import { getQuestionEditorCapabilities } from "./permissions";

const adminSession = {
  user: { id: "1", role: "ADMIN" },
  expires: "2099-01-01T00:00:00.000Z",
} as Session;

const editorSession = {
  user: { id: "2", role: "EDITOR" },
  expires: "2099-01-01T00:00:00.000Z",
} as Session;

test("admins can save and approve changes to an already approved question", () => {
  const capabilities = getQuestionEditorCapabilities(adminSession, {
    createdByUserId: 2,
    reviewStatus: "APPROVED",
    isArchived: false,
  });
  assert.equal(capabilities.canSaveDraft, true);
  assert.equal(capabilities.canApproveQuestion, true);
  assert.equal(capabilities.canManageCategories, true);
  assert.equal(capabilities.canCloneQuestion, true);
});

test("editors cannot manage categories or clone another editor's question", () => {
  const capabilities = getQuestionEditorCapabilities(editorSession, {
    createdByUserId: 3,
    reviewStatus: "DRAFT",
    isArchived: false,
  });
  assert.equal(capabilities.canManageCategories, false);
  assert.equal(capabilities.canCloneQuestion, false);
});
