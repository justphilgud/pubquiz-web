import assert from "node:assert/strict";
import test from "node:test";

import { isEditableKeyboardTarget } from "./keyboardShortcuts";

function target(tagName: string, options: { editable?: boolean; insideEditable?: boolean } = {}) {
  return {
    tagName,
    isContentEditable: options.editable ?? false,
    closest: () => options.insideEditable ? {} : null,
  } as unknown as EventTarget;
}

test("navigation hotkeys leave every text entry surface untouched", () => {
  assert.equal(isEditableKeyboardTarget(target("INPUT")), true);
  assert.equal(isEditableKeyboardTarget(target("TEXTAREA")), true);
  assert.equal(isEditableKeyboardTarget(target("SELECT")), true);
  assert.equal(isEditableKeyboardTarget(target("DIV", { editable: true })), true);
  assert.equal(isEditableKeyboardTarget(target("SPAN", { insideEditable: true })), true);
  assert.equal(isEditableKeyboardTarget(target("BUTTON")), false);
  assert.equal(isEditableKeyboardTarget(null), false);
});
