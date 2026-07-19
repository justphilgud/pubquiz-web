import assert from "node:assert/strict";
import test from "node:test";
import { createGeneratorFingerprint } from "./fingerprints";

const input = {
  generatorId: "audio_reverse" as const,
  generatorVersion: 1,
  media: [{ mediaId: 7, slotKey: "music_original_audio", pathname: "preview/question-media/a", size: 42, contentType: "audio/wav", etag: "etag-a" }],
};

test("generator fingerprint is stable and changes with version or ETag", () => {
  assert.equal(createGeneratorFingerprint(input), createGeneratorFingerprint(input));
  assert.notEqual(createGeneratorFingerprint(input), createGeneratorFingerprint({ ...input, generatorVersion: 2 }));
  assert.notEqual(createGeneratorFingerprint(input), createGeneratorFingerprint({ ...input, media: [{ ...input.media[0], etag: "etag-b" }] }));
  assert.notEqual(
    createGeneratorFingerprint({ ...input, generatorId: "image_pixelate", parameters: { stagePreset: "three_stage_default_v1" } }),
    createGeneratorFingerprint({ ...input, generatorId: "image_pixelate", parameters: { stagePreset: "future" } }),
  );
});
