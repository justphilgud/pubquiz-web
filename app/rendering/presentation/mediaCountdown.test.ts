import assert from "node:assert/strict";
import test from "node:test";
import { formatMediaRemaining, mediaRemainingSeconds } from "./mediaCountdown";
test("remaining time follows actual duration and seek position, including paused playback and restart", () => {
  for (const [duration, position, expected] of [[12, 0, 12], [125, 0, 125], [125, 20.2, 105], [125, 20.2, 105], [125, 0, 125], [125, 125, 0], [125, 150, 0]]) {
    assert.equal(mediaRemainingSeconds(duration, position), expected);
  }
  assert.equal(formatMediaRemaining(125), "2:05");
  assert.equal(formatMediaRemaining(0), "0:00");
});
test("unknown, absent or invalid metadata never creates a countdown", () => {
  for (const duration of [NaN, Infinity, 0, -1]) assert.equal(mediaRemainingSeconds(duration, 0), null);
  assert.equal(mediaRemainingSeconds(125, NaN), null);
});
