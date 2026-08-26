import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  INTRO_SLIDES,
  OUTRO_SLIDES,
  FIXED_SLIDE_FLOW_TYPES,
  parsePrizeSlots,
  serializePrizeSlots,
} from "./fixedSlidesPolicy";

test("the common intro editor contains exactly the five fixed slides", () => {
  assert.deepEqual(
    INTRO_SLIDES.map((slide) => slide.title),
    [
      "Wartebildschirm",
      "Countdown bis zum Start",
      "Begrüßung",
      "Regeln",
      "Preise",
    ],
  );
});

test("the outro contains announcements, optional question submission and calendar CTA", () => {
  assert.deepEqual(
    OUTRO_SLIDES.map((slide) => slide.title),
    ["Bekanntmachungen", "Frage einreichen", "PubQuiz-Kalender"],
  );
});

test("the calendar outro edits and renders its existing flow configuration", () => {
  const editor = readFileSync("app/quiz/[quizId]/slides/outro/page.tsx", "utf8");
  const action = readFileSync("app/quiz/[quizId]/slides/fixedSlideActions.ts", "utf8");
  const renderer = readFileSync("app/rendering/presentation/PresentationSlideRenderer.tsx", "utf8");

  assert.match(editor, /name="title"/);
  assert.match(editor, /name="body"/);
  assert.match(editor, /name="ctaText"/);
  assert.match(action, /teamHint: text\(formData, "ctaText"\)/);
  assert.match(renderer, /config\.teamHint/);
});

test("every editable fixed slide maps to one productive flow item", () => {
  assert.deepEqual(Object.keys(FIXED_SLIDE_FLOW_TYPES), [
    "waiting",
    "countdown",
    "welcome",
    "rules",
    "prizes",
    "announcements",
    "questionSubmission",
    "calendar",
  ]);
  assert.equal(new Set(Object.values(FIXED_SLIDE_FLOW_TYPES)).size, 8);
});

test("multi-word prizes remain one prize per line", () => {
  assert.deepEqual(
    parsePrizeSlots(
      "Gutschein über 50 €\nEin Essen für zwei Personen\nRuhm und Ehre",
    ),
    [
      "Gutschein über 50 €",
      "Ein Essen für zwei Personen",
      "Ruhm und Ehre",
    ],
  );
});

test("prize normalization supports CRLF, repeated spaces and NBSP", () => {
  assert.deepEqual(
    parsePrizeSlots("  Gutschein\u00a0 über  50 € \r\nGetränkerunde\r\n"),
    ["Gutschein über 50 €", "Getränkerunde", ""],
  );
});

test("empty placements do not shift following prizes", () => {
  const serialized = serializePrizeSlots(["", "Getränkerunde", ""]);

  assert.equal(serialized, "\nGetränkerunde\n");
  assert.deepEqual(parsePrizeSlots(serialized), ["", "Getränkerunde", ""]);
});
