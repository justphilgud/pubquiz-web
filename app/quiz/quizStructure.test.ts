import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDefaultQuizSections,
  buildQuickQuizSections,
  getNextAutomaticBlockTitle,
  isAutomaticBlockTitle,
  synchronizeAutomaticBlockTitles,
} from "./quizStructure";
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
  assert.equal(sections[1].titel, "Block 1");
});

test("quick quiz creation creates exactly the configured question blocks", () => {
  const sections = buildQuickQuizSections(9, 3);
  assert.equal(sections.length, 5);
  assert.deepEqual(sections.map((entry) => entry.sortierung), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    sections.filter(isQuestionSection).map((entry) => entry.titel),
    ["Block 1", "Block 2", "Block 3"],
  );
});

test("automatic block naming is independent of the presentation template", () => {
  for (const templateId of [null, "neon", "corporate", "storybook"] as const) {
    const sections = buildDefaultQuizSections(9);
    assert.equal(
      sections.find(isQuestionSection)?.titel,
      "Block 1",
      templateId ?? "without template",
    );
  }
});

test("automatic block naming follows the number of question blocks", () => {
  const sections = [
    { abschnitt_typ: "intro", titel: "Block 1" },
    { abschnitt_typ: "fragenblock", titel: "Block 1" },
    { abschnitt_typ: "fragenrunde", titel: "Musik & Erinnerungen" },
    { abschnitt_typ: "fragenblock", titel: "Block 3" },
    { abschnitt_typ: "outro", titel: "Block 2" },
  ];
  assert.equal(getNextAutomaticBlockTitle(sections), "Block 4");
});

test("automatic block titles are synchronized after reordering", () => {
  const reordered = synchronizeAutomaticBlockTitles([
    { id: 90, abschnitt_typ: "intro", titel: "Intro" },
    { id: 3, abschnitt_typ: "fragenblock", titel: "Block 3" },
    { id: 1, abschnitt_typ: "fragenblock", titel: "Fragenblock 1" },
    { id: 2, abschnitt_typ: "fragenrunde", titel: "Block 2" },
    { id: 91, abschnitt_typ: "outro", titel: "Outro" },
  ]);
  assert.deepEqual(
    reordered.map((section) => section.titel),
    ["Intro", "Block 1", "Block 2", "Block 3", "Outro"],
  );
  assert.equal(new Set(reordered.map((section) => section.titel)).size, 5);
});

test("custom block titles remain unchanged while automatic neighbours follow order", () => {
  const synchronized = synchronizeAutomaticBlockTitles([
    { abschnitt_typ: "fragenblock", titel: "Block 3" },
    { abschnitt_typ: "fragenblock", titel: "Musik & Erinnerungen" },
    { abschnitt_typ: "fragenblock", titel: "Fragenblock 1" },
  ]);
  assert.deepEqual(synchronized.map((entry) => entry.titel), [
    "Block 1",
    "Musik & Erinnerungen",
    "Block 3",
  ]);
});

test("only explicit generated title patterns count as automatic", () => {
  const existing = [
    "Block",
    "Block 1",
    "Fragenblock 1",
    "Fragenblock",
    "Musik & Erinnerungen",
  ];
  assert.deepEqual(existing.map(isAutomaticBlockTitle), [true, true, true, false, false]);
});

test("legacy bare Block is normalized while a custom title is preserved", () => {
  const synchronized = synchronizeAutomaticBlockTitles([
    { abschnitt_typ: "fragenblock", titel: "Block" },
    { abschnitt_typ: "fragenblock", titel: "Meine Runde" },
    { abschnitt_typ: "fragenblock", titel: "Block 7" },
  ]);
  assert.deepEqual(synchronized.map((entry) => entry.titel), [
    "Block 1",
    "Meine Runde",
    "Block 3",
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
