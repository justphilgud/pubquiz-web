import assert from "node:assert/strict";
import test from "node:test";
import { questionPhaseMedia } from "./questionPhaseMedia";

const original = { slotKey: "music_original_audio", datei: "original.wav" };
const reversed = { slotKey: "music_reverse_audio", datei: "reverse.mp3" };
test("reverse question selects generated audio regardless of persistence order; resolution selects original", () => {
  for (const media of [[original, reversed], [reversed, original]]) {
    const unchanged = structuredClone(media);
    assert.deepEqual(questionPhaseMedia("musik_rueckwaerts", media, "QUESTION"), [reversed]);
    assert.deepEqual(questionPhaseMedia("musik_rueckwaerts", media, "SOLUTION"), [original]);
    assert.deepEqual(media, unchanged);
  }
});
test("missing generated audio never falls back to original; ambiguous legacy audio is not guessed", () => {
  assert.deepEqual(questionPhaseMedia("musik_rueckwaerts", [original], "QUESTION"), []);
  const legacy = { datei: "prepared.mp3" };
  assert.deepEqual(questionPhaseMedia("musik_rueckwaerts", [legacy], "QUESTION"), [legacy]);
  assert.deepEqual(questionPhaseMedia("musik_rueckwaerts", [legacy], "SOLUTION"), []);
  assert.deepEqual(questionPhaseMedia("musik_rueckwaerts", [legacy, { datei: "other.mp3" }], "QUESTION"), []);
});
test("normal music reuses question audio or explicit separate resolution audio without processing", () => {
  const normal = { slotKey: "question_audio", datei: "normal.mp3" };
  assert.deepEqual(questionPhaseMedia("musik", [normal], "QUESTION"), [normal]);
  assert.deepEqual(questionPhaseMedia("musik", [normal], "SOLUTION"), [normal]);
  assert.deepEqual(questionPhaseMedia("musik", [original, normal], "QUESTION"), [normal]);
  assert.deepEqual(questionPhaseMedia("musik", [original, normal], "SOLUTION"), [original]);
  assert.deepEqual(questionPhaseMedia("standard", [normal, original], "QUESTION"), [normal, original]);
});
