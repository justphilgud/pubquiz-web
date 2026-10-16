import assert from "node:assert/strict";
import test from "node:test";
import { questionPhaseMedia } from "./questionPhaseMedia";
import { faceMorphPresentationMedia } from "./faceMorphPresentationMedia";

test("FaceMorph adapts editor field originals to fixed roles, independent of field/media order, without question leaks", () => {
  const media = (datei: string, slot_key: string) => ({ datei, slot_key, medientyp: { medientyp: "Bild" } });
  const morph = media("morph.png", "face_morph_result");
  const a = media("a.png", "answer_image"); const b = media("b.png", "answer_image");
  const fields = [{ sortierung: 2, medien: [b] }, { sortierung: 1, medien: [a] }];
  const before = structuredClone(fields);
  const adapted = faceMorphPresentationMedia("face_morph", [morph], fields);
  assert.equal(adapted.find(m => m.slot_key === "face_morph_person_a_original")?.datei, "a.png");
  assert.equal(adapted.find(m => m.slot_key === "face_morph_person_b_original")?.datei, "b.png");
  assert.deepEqual(fields, before);
  const phaseMedia = adapted.map(m => ({ datei: m.datei, slotKey: m.slot_key }));
  assert.deepEqual(questionPhaseMedia("face_morph", phaseMedia, "QUESTION"), [{ datei: "morph.png", slotKey: "face_morph_result" }]);
  assert.deepEqual(faceMorphPresentationMedia("standard", [morph], fields), [morph]);
  const explicitA = media("explicit-a.png", "face_morph_person_a_original");
  assert.equal(faceMorphPresentationMedia("face_morph", [explicitA, morph], fields).filter(m => m.slot_key === explicitA.slot_key).length, 1);
  assert.equal(faceMorphPresentationMedia("face_morph", [explicitA, morph], fields)[0].datei, "explicit-a.png");
});

test("FaceMorph never borrows an unrelated image for a missing or ambiguous original", () => {
  const image = { datei: "a.png", slot_key: "answer_image", medientyp: { medientyp: "Bild" } };
  const missingA = [{ sortierung: 1, medien: [] }, { sortierung: 2, medien: [image] }];
  assert.deepEqual(faceMorphPresentationMedia("face_morph", [], missingA).map(m => m.slot_key), ["face_morph_person_b_original"]);
  assert.deepEqual(faceMorphPresentationMedia("face_morph", [], [{ sortierung: 1, medien: [image] }]), []);
  assert.deepEqual(faceMorphPresentationMedia("face_morph", [], [{ sortierung: 1, medien: [image] }, { sortierung: 1, medien: [image] }]), []);
  assert.deepEqual(faceMorphPresentationMedia("face_morph", [], [{ sortierung: 1, medien: [image, { ...image, datei: "other.png" }] }, { sortierung: 2, medien: [] }]), []);
});

test("translated reading uses its prepared output only and never substitutes an attached song", () => {
  const original = { datei: "original.mp3", slotKey: "question_audio" };
  const prepared = { datei: "spoken.mp3?download=1", slotKey: "lyrics_tts_audio" };
  assert.deepEqual(questionPhaseMedia("uebersetzt_vorgelesen", [original, prepared], "QUESTION"), [prepared]);
  assert.deepEqual(questionPhaseMedia("uebersetzt_vorgelesen", [original], "QUESTION"), []);
  assert.deepEqual(questionPhaseMedia("uebersetzt_vorgelesen", [{ datei: "legacy-spoken.mp3" }], "QUESTION"), [{ datei: "legacy-spoken.mp3" }]);
});
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
