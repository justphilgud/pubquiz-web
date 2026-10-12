import assert from "node:assert/strict";
import test from "node:test";
import { formatMediaRemaining, mediaRemainingSeconds, introResumePosition } from "./mediaCountdown";

test("intro reload resumes only the same audio command and preserves pause/end", () => {
  const record = { source: "intro.mp3", commandId: 7, duration: 212, position: 50, recordedAt: 1000, playing: true };
  assert.equal(introResumePosition(record, "intro.mp3", 7, 212, 6000), 55);
  assert.equal(introResumePosition({ ...record, playing: false }, "intro.mp3", 7, 212, 6000), 50);
  assert.equal(introResumePosition(record, "other.mp3", 7, 212, 6000), null);
  assert.equal(introResumePosition({ ...record, source: "quiz:9:run1|intro.mp3" }, "quiz:9:run2|intro.mp3", 7, 212, 6000), null);
  assert.equal(introResumePosition(record, "intro.mp3", 8, 212, 6000), null);
  assert.equal(introResumePosition(record, "intro.mp3", 7, 16, 6000), null);
  assert.equal(introResumePosition({ ...record, position: 212, playing: false }, "intro.mp3", 7, 212, 6000), 212);
  assert.equal(introResumePosition({ ...record, position: NaN }, "intro.mp3", 7, 212, 6000), null);
});
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
