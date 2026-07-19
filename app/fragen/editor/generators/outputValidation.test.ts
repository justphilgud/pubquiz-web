import assert from "node:assert/strict";
import test from "node:test";
import { getGeneratorDefinition } from "./registry";
import { validateGeneratorProcessorOutputs } from "./outputValidation";

const definition = getGeneratorDefinition("image_pixelate")!;
const output = (slotKey: "pixel_stage_3_image" | "pixel_stage_2_image" | "pixel_stage_1_image", width = 320) => ({
  slotKey, bytes: Buffer.from([1]), contentType: "image/png", fileExtension: "png", width, height: 180,
});
const valid = [output("pixel_stage_3_image"), output("pixel_stage_2_image"), output("pixel_stage_1_image")];

test("multi-output validation accepts exactly one complete matching stage group", () => {
  assert.equal(validateGeneratorProcessorOutputs(definition, valid), true);
  assert.equal(validateGeneratorProcessorOutputs(definition, valid.slice(0, 2)), false);
  assert.equal(validateGeneratorProcessorOutputs(definition, [valid[0], valid[0], valid[2]]), false);
  assert.equal(validateGeneratorProcessorOutputs(definition, [valid[0], valid[1], output("pixel_stage_1_image", 321)]), false);
});
