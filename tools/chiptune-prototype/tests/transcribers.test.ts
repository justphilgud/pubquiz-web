import assert from "node:assert/strict";
import test from "node:test";
import { getTranscriber } from "../src/transcribers/registry";

test("FFT and Basic Pitch expose the same transcriber interface", () => {
  for (const id of ["fft", "basic-pitch"] as const) {
    const transcriber = getTranscriber(id);
    assert.equal(transcriber.id, id);
    assert.equal(typeof transcriber.transcribe, "function");
  }
});
