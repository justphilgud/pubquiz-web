import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultQuizSections, buildQuickQuizSections } from "./quizStructure";

test("regular quiz creation keeps the default intro, question and outro sections", () => {
  assert.deepEqual(buildDefaultQuizSections(9).map((entry) => entry.abschnitt_typ), [
    "intro",
    "fragenblock",
    "outro",
  ]);
});

test("quick quiz creation creates exactly the configured question blocks", () => {
  const sections = buildQuickQuizSections(9, 3);
  assert.equal(sections.length, 5);
  assert.deepEqual(sections.map((entry) => entry.sortierung), [1, 2, 3, 4, 5]);
});
