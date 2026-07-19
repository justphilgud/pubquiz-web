import assert from "node:assert/strict";
import test from "node:test";
import {
  generatorParametersEqual,
  normalizeGeneratorParameters,
} from "./parameters";

test("generator parameters apply defaults and reject unknown values", () => {
  assert.deepEqual(normalizeGeneratorParameters("audio_bitcrush", undefined), { preset: "classic" });
  assert.deepEqual(normalizeGeneratorParameters("image_pixelate", undefined), { stagePreset: "three_stage_default_v1" });
  assert.deepEqual(normalizeGeneratorParameters("image_pixelate", { stagePreset: "three_stage_default_v1" }), { stagePreset: "three_stage_default_v1" });
  assert.equal(normalizeGeneratorParameters("image_pixelate", { stagePreset: "unknown" }), null);
  assert.equal(normalizeGeneratorParameters("audio_reverse", { strength: "strong" }), null);
});

test("pixel stage preset participates in generator identity", () => {
  assert.equal(generatorParametersEqual({ stagePreset: "three_stage_default_v1" }, { stagePreset: "three_stage_default_v1" }), true);
  assert.equal(generatorParametersEqual({ stagePreset: "three_stage_default_v1" }, {}), false);
});
