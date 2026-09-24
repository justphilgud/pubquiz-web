import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MEME_QUESTION_CONFIG,
  createMemeRunWindow,
  memeCountdownRemainingSeconds,
  parseMemeCaptionPayload,
  parseMemeQuestionConfig,
} from "./memeCaption";

test("accepts the supported quiz configuration and rejects unsafe bounds", () => {
  assert.deepEqual(parseMemeQuestionConfig(null), DEFAULT_MEME_QUESTION_CONFIG);
  assert.deepEqual(parseMemeQuestionConfig({
    version: 1,
    responseDurationSeconds: 180,
    maxPresentedMemes: null,
  }), {
    version: 1,
    responseDurationSeconds: 180,
    maxPresentedMemes: null,
  });
  assert.equal(parseMemeQuestionConfig({ version: 1, responseDurationSeconds: 59, maxPresentedMemes: 5 }), null);
  assert.equal(parseMemeQuestionConfig({ version: 1, responseDurationSeconds: 90, maxPresentedMemes: 0 }), null);
  assert.equal(parseMemeQuestionConfig({ version: 1, responseDurationSeconds: 90, maxPresentedMemes: 2.5 }), null);
});

test("opens one authoritative deadline window and reaches zero at the boundary", () => {
  const openedAt = new Date("2026-09-23T18:00:00.000Z");
  const window = createMemeRunWindow({
    version: 1,
    responseDurationSeconds: 90,
    maxPresentedMemes: 5,
  }, openedAt);
  assert.equal(window.state, "COUNTDOWN");
  assert.equal(window.deadlineAt.toISOString(), "2026-09-23T18:01:30.000Z");
  assert.equal(memeCountdownRemainingSeconds(window.deadlineAt.toISOString(), "COUNTDOWN", openedAt.getTime() + 30_000), 60);
  assert.equal(memeCountdownRemainingSeconds(window.deadlineAt.toISOString(), "COUNTDOWN", window.deadlineAt.getTime()), 0);
  assert.equal(memeCountdownRemainingSeconds(null, "CLOSED", window.deadlineAt.getTime()), 0);
});

test("requires at least one field at submission level while preserving valid structured text", () => {
  assert.deepEqual(parseMemeCaptionPayload({ topText: " oben ", bottomText: " unten " }), {
    topText: "oben",
    bottomText: "unten",
  });
  assert.equal(parseMemeCaptionPayload({ topText: "x".repeat(81), bottomText: "" }), null);
  assert.equal(parseMemeCaptionPayload({ topText: "oben" }), null);
});

test("zoned payloads trim stable caption IDs while legacy payloads stay valid", () => {
  assert.deepEqual(parseMemeCaptionPayload({ captions: { bubble: " Hallo ", panel_2: " Welt " } }), {
    captions: { bubble: "Hallo", panel_2: "Welt" },
  });
  assert.equal(parseMemeCaptionPayload({ captions: { "not valid": "Text" } }), null);
  assert.equal(parseMemeCaptionPayload({ captions: { bubble: "x".repeat(81) } }), null);
});
