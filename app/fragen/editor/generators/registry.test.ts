import assert from "node:assert/strict";
import test from "node:test";
import { getActiveGeneratorsForTemplate, getGeneratorDefinition, validateGeneratorRegistry } from "./registry";

test("generator registry contains the active media generators", () => {
  assert.deepEqual(validateGeneratorRegistry(), []);
  assert.equal(getGeneratorDefinition("audio_reverse")?.version, 1);
  assert.deepEqual(getActiveGeneratorsForTemplate("musik_rueckwaerts").map((entry) => entry.id), ["audio_reverse"]);
  assert.deepEqual(getActiveGeneratorsForTemplate("eight_bit").map((entry) => entry.id), ["audio_bitcrush"]);
  assert.deepEqual(getActiveGeneratorsForTemplate("pixelbild").map((entry) => entry.id), ["image_pixelate"]);
  assert.equal(getGeneratorDefinition("image_pixelate")?.version, 2);
  assert.deepEqual(getGeneratorDefinition("image_pixelate")?.outputSlots, ["pixel_stage_3_image", "pixel_stage_2_image", "pixel_stage_1_image"]);
  assert.deepEqual(getActiveGeneratorsForTemplate("standard"), []);
  assert.equal(getGeneratorDefinition("image_face_morph")?.active, false);
  assert.equal(getGeneratorDefinition("text_to_speech")?.active, false);
  assert.equal(getGeneratorDefinition("audio_chiptune")?.active, false);
  assert.equal(getGeneratorDefinition("unknown"), null);
});
