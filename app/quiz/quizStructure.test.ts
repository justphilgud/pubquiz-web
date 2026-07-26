import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultQuizSections, buildQuickQuizSections } from "./quizStructure";
import {
  isIntroSection,
  isOutroSection,
  isQuestionSection,
} from "./quizSectionPolicy";

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

test("section identity depends only on the stored section type", () => {
  const renamedIntro = {
    abschnitt_typ: "intro",
    titel: "Umbenannter Einstieg",
  };
  const questionNamedIntro = {
    abschnitt_typ: "fragenblock",
    titel: "Intro",
  };
  const renamedOutro = { abschnitt_typ: "outro", titel: "Abschluss" };
  const questionNamedOutro = {
    abschnitt_typ: "fragenblock",
    titel: "Outro",
  };

  assert.equal(isIntroSection(renamedIntro), true);
  assert.equal(isIntroSection(questionNamedIntro), false);
  assert.equal(isOutroSection(renamedOutro), true);
  assert.equal(isOutroSection(questionNamedOutro), false);
});

test("question section policy keeps the legacy fragenrunde type", () => {
  assert.equal(isQuestionSection({ abschnitt_typ: "fragenblock" }), true);
  assert.equal(isQuestionSection({ abschnitt_typ: "fragenrunde" }), true);
  assert.equal(isQuestionSection({ abschnitt_typ: "intro" }), false);
});
