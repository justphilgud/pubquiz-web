import assert from "node:assert/strict";
import test from "node:test";
import { estimateReadingDuration, formatReadingDuration } from "./readingDuration";

test("duration follows the current text and speed without modifying either", () => {
  const text = Array(150).fill("Wort").join(" ");
  assert.deepEqual(estimateReadingDuration(text), { words: 150, seconds: 60 });
  assert.equal(estimateReadingDuration(text, 2).seconds, 30);
  assert.equal(estimateReadingDuration(text, 0.5).seconds, 120);
  assert.equal(estimateReadingDuration(text + " noch einmal").words, 152);
  assert.equal(text.split(" ").length, 150);
  assert.equal(formatReadingDuration(65), "1:05 Min.");
});

test("empty, whitespace and invalid speed are handled deterministically", () => {
  assert.deepEqual(estimateReadingDuration(" \n\t"), { words: 0, seconds: 0 });
  assert.equal(estimateReadingDuration("eins\nzwei\tdrei").words, 3);
  for (const speed of [0, -1, NaN, Infinity]) assert.equal(estimateReadingDuration("Wort", speed).seconds, 1);
});
