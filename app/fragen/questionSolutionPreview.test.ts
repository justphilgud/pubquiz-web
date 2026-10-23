import assert from "node:assert/strict";
import test from "node:test";
import { buildQuestionSolutionPreview } from "./questionSolutionPreview";

test("quiz overview uses stored songs, pixel solutions, all correct answers and canonical order", () => {
  for (const templateId of ["musik", "eight_bit", "musik_rueckwaerts"]) {
    for (const [artist, title] of [["ABBA", "Dancing Queen"], ["Queen", "Radio Ga Ga"]]) {
      assert.deepEqual(buildQuestionSolutionPreview({ templateId, classicAnswers: [], structuredFields: [
        { label: "Interpret", solutions: [{ text: artist, isAccepted: true }] },
        { label: "Titel", solutions: [{ text: title, isAccepted: true }] },
      ] })?.values, [`Interpret: ${artist}`, `Titel: ${title}`]);
    }
  }
  for (const motif of ["Eiffelturm", "Brandenburger Tor"]) assert.deepEqual(buildQuestionSolutionPreview({ templateId: "pixelbild", classicAnswers: [{ text: motif, isCorrect: true }], structuredFields: [] })?.values, [motif]);
  assert.deepEqual(buildQuestionSolutionPreview({ classicAnswers: ["A", "B", "C", "D"].map(text => ({ text, isCorrect: true })), structuredFields: [], maxValues: 100 })?.values, ["A", "B", "C", "D"]);
  assert.deepEqual(buildQuestionSolutionPreview({ classicAnswers: [], structuredFields: [], templateData: { kind: "ORDERING", scoring: "EXACT", items: ["Früh", "Spät"].map((text, index) => ({ id: String(index), text, explanation: "" })) } })?.values, ["1. Früh", "2. Spät"]);
  assert.equal(buildQuestionSolutionPreview({ templateId: "meme_beschriften", classicAnswers: [], structuredFields: [] }), null);
  assert.deepEqual(buildQuestionSolutionPreview({ classicAnswers: [], structuredFields: [], templateData: { kind: "ANAGRAM", name: "Tom Riddle", selectedSolution: "I am Lord", suggestions: [], wordCountPreference: "AUTO" } })?.values, ["Tom Riddle"]);
});

test("solution preview exposes only correct classic answers", () => {
  assert.deepEqual(buildQuestionSolutionPreview({
    classicAnswers: [
      { text: "40", isCorrect: true },
      { text: "60", isCorrect: false },
      { text: "90", isCorrect: false },
    ],
    structuredFields: [],
  }), {
    label: "Richtige Lösung",
    values: ["40"],
    remainingCount: 0,
  });
});

test("solution preview combines accepted structured solutions without duplicates", () => {
  assert.deepEqual(buildQuestionSolutionPreview({
    classicAnswers: [{ text: "Berlin", isCorrect: true }],
    structuredFields: [
      {
        label: "Stadt",
        solutions: [
          { text: "Berlin", isAccepted: true },
          { text: "Bonn", isAccepted: false },
        ],
      },
      {
        label: "",
        solutions: [{ text: "Berlin", isAccepted: true }],
      },
    ],
  }), {
    label: "Richtige Lösungen",
    values: ["Berlin", "Stadt: Berlin"],
    remainingCount: 0,
  });
});

test("solution preview stays compact and does not invent a special-template answer", () => {
  assert.deepEqual(buildQuestionSolutionPreview({
    classicAnswers: [],
    structuredFields: [{
      label: "Lösung",
      solutions: ["A", "B", "C", "D"].map((text) => ({ text, isAccepted: true })),
    }],
  }), {
    label: "Richtige Lösungen",
    values: ["Lösung: A", "Lösung: B", "Lösung: C"],
    remainingCount: 1,
  });
  assert.equal(buildQuestionSolutionPreview({ classicAnswers: [], structuredFields: [] }), null);
});

 test("country facts preview displays the country name while preserving classic answers", () => {
  const answers = [{ text: "CH", isCorrect: true }];
  assert.deepEqual(buildQuestionSolutionPreview({ templateId: "fakten_land", classicAnswers: answers, structuredFields: [] })?.values, ["Schweiz"]);
  assert.deepEqual(buildQuestionSolutionPreview({ templateId: "standard", classicAnswers: answers, structuredFields: [] })?.values, ["CH"]);
 });
