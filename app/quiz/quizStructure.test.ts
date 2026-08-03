import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultQuizSections, buildQuickQuizSections } from "./quizStructure";
import {
  isIntroSection,
  isOutroSection,
  isQuestionSection,
} from "./quizSectionPolicy";

test("regular quiz creation keeps the default intro, question and outro sections", () => {
  const sections = buildDefaultQuizSections(9);
  assert.deepEqual(sections.map((entry) => entry.abschnitt_typ), [
    "intro",
    "fragenblock",
    "outro",
  ]);
  assert.equal(sections[1].titel, "Block");
});

test("quick quiz creation creates exactly the configured question blocks", () => {
  const sections = buildQuickQuizSections(9, 3);
  assert.equal(sections.length, 5);
  assert.deepEqual(sections.map((entry) => entry.sortierung), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    sections.filter(isQuestionSection).map((entry) => entry.titel),
    ["Block", "Block", "Block"],
  );
});

test("automatic block naming is independent of the presentation template", () => {
  for (const templateId of [null, "neon", "corporate", "storybook"] as const) {
    const sections = buildDefaultQuizSections(9);
    assert.equal(
      sections.find(isQuestionSection)?.titel,
      "Block",
      templateId ?? "without template",
    );
  }
});

test("existing and individually renamed block titles are not rewritten", () => {
  const existing = [
    { abschnitt_typ: "fragenblock", titel: "Fragenblock" },
    { abschnitt_typ: "fragenblock", titel: "Musik & Erinnerungen" },
  ];
  buildDefaultQuizSections(9);
  assert.deepEqual(existing.map((entry) => entry.titel), [
    "Fragenblock",
    "Musik & Erinnerungen",
  ]);
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
