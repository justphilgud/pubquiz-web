import assert from "node:assert/strict";
import test from "node:test";
import {
  CATEGORY_NAME_MAX_LENGTH,
  canDeleteCategoryWithAssignments,
  isValidCategoryName,
  normalizeCategoryName,
} from "./categoryPolicy";

test("category names are normalized and bounded", () => {
  assert.equal(normalizeCategoryName("  Natur   und Technik  "), "Natur und Technik");
  assert.equal(isValidCategoryName(""), false);
  assert.equal(isValidCategoryName("x".repeat(CATEGORY_NAME_MAX_LENGTH)), true);
  assert.equal(isValidCategoryName("x".repeat(CATEGORY_NAME_MAX_LENGTH + 1)), false);
});

test("categories with question assignments cannot be deleted", () => {
  assert.equal(canDeleteCategoryWithAssignments(0), true);
  assert.equal(canDeleteCategoryWithAssignments(1), false);
});
