import assert from "node:assert/strict";
import test from "node:test";
import { questionPhaseMedia } from "./questionPhaseMedia";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PresentationSlideRenderer from "./PresentationSlideRenderer";
import { buildPresentationQualityFixture } from "./presentationQualityFixtures";

const original = { slotKey: "music_original_audio", datei: "original.wav" };
const reversed = { slotKey: "music_reverse_audio", datei: "reverse.mp3" };
test("music solution mounts original audio without an overlay and never duplicates overlay playback", () => {
  for (const templateId of ["musik", "musik_rueckwaerts", "eight_bit"]) {
    const fixture = buildPresentationQualityFixture("structured-audio", "NEON");
    assert.equal(fixture.slide.typ, "frage");
    if (fixture.slide.typ !== "frage") throw new Error("Expected question fixture");
    fixture.slide.frage.templateId = templateId;
    fixture.slide.frage.medien = [
      { ...original, medien_id: 901, medientyp: "audio", bemerkung: null, sortierung: 1 },
      { slotKey: templateId === "musik" ? "question_audio" : templateId === "eight_bit" ? "music_bitcrush_audio" : "music_reverse_audio", datei: "processed.mp3", medien_id: 902, medientyp: "audio", bemerkung: null, sortierung: 2 },
    ];
    fixture.slide = { ...fixture.slide, typ: "aufloesung" };
    fixture.slides = [fixture.slide];
    fixture.displayState.renderMode = "PRESENTATION";
    for (const mediaOverlayActive of [false, true]) {
      fixture.displayState.mediaOverlayActive = mediaOverlayActive;
      const markup = renderToStaticMarkup(createElement(PresentationSlideRenderer, fixture));
      assert.equal((markup.match(/<audio\b/g) ?? []).length, 1);
      assert.match(markup, /src="\/medien\/original\.wav"/);
      assert.doesNotMatch(markup, /src="\/medien\/processed\.mp3"/);
    }
    fixture.displayState.renderMode = "DESIGN_PREVIEW";
    assert.doesNotMatch(renderToStaticMarkup(createElement(PresentationSlideRenderer, fixture)), /<audio\b/);
  }
});
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
