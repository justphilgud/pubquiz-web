import assert from "node:assert/strict";
import test from "node:test";

import {
  allocatePixelQuestionPoints,
  canStopPixelQuestion,
  createPixelLiveConfigSnapshot,
  pixelRuntimeStageToMediaSlot,
  resolveEffectivePixelStage,
} from "./pixelLiveInteraction";

test("pixel live config defaults to 15 seconds and maps historic slots chronologically", () => {
  const config = createPixelLiveConfigSnapshot(null);
  assert.deepEqual(config.stageDurationSeconds, { 1: 15, 2: 15, 3: 15 });
  assert.equal(pixelRuntimeStageToMediaSlot(1), "pixel_stage_3_image");
  assert.equal(pixelRuntimeStageToMediaSlot(2), "pixel_stage_2_image");
  assert.equal(pixelRuntimeStageToMediaSlot(3), "pixel_stage_1_image");
});

test("pixel stage timing supports custom durations, boundaries and a frozen stop", () => {
  const config = createPixelLiveConfigSnapshot({
    stageDurationsSeconds: { stage3: 30, stage2: 30, stage1: 30 },
    createPixelQuestionByAnswer: { answer1: false, answer2: false },
  });
  const openedAt = new Date("2026-08-15T18:00:00.000Z");
  assert.equal(resolveEffectivePixelStage({ openedAt, serverNow: new Date(openedAt.getTime() + 29_999), config }), 1);
  assert.equal(resolveEffectivePixelStage({ openedAt, serverNow: new Date(openedAt.getTime() + 30_000), config }), 2);
  assert.equal(resolveEffectivePixelStage({ openedAt, serverNow: new Date(openedAt.getTime() + 60_000), config }), 3);
  assert.equal(resolveEffectivePixelStage({ openedAt, serverNow: new Date(openedAt.getTime() + 120_000), config, stoppedAtStage: 2 }), 2);
});

test("invalid persisted durations fall back safely", () => {
  const config = createPixelLiveConfigSnapshot({
    stageDurationsSeconds: { stage3: 0, stage2: 121, stage1: 15.5 },
    createPixelQuestionByAnswer: { answer1: false, answer2: false },
  });
  assert.deepEqual(config.stageDurationSeconds, { 1: 15, 2: 15, 3: 15 });
});

test("stop capability requires an open early stage and a current draft", () => {
  assert.equal(canStopPixelQuestion({ state: "OPEN", stage: 1, stopped: false, hasDraftContent: true, isStopper: false }), true);
  assert.equal(canStopPixelQuestion({ state: "OPEN", stage: 3, stopped: false, hasDraftContent: true, isStopper: false }), false);
  assert.equal(canStopPixelQuestion({ state: "COUNTDOWN", stage: 2, stopped: true, hasDraftContent: true, isStopper: false }), false);
  assert.equal(canStopPixelQuestion({ state: "OPEN", stage: 2, stopped: false, hasDraftContent: false, isStopper: false }), false);
});

function points(stage: 1 | 2 | 3, evaluations: Parameters<typeof allocatePixelQuestionPoints>[0]["evaluations"]) {
  return allocatePixelQuestionPoints({ stage, evaluations }).map((entry) => ({
    id: entry.teamAnswerId,
    points: String(entry.points),
    outcome: entry.outcome,
  }));
}

test("pixel scoring applies normal, exclusive bonus and wrong-stop rules", () => {
  assert.deepEqual(points(1, [
    { teamAnswerId: 1, status: "CORRECT", isStopper: true, isFinalSubmission: true },
    { teamAnswerId: 2, status: "WRONG", isStopper: false, isFinalSubmission: true },
  ]), [
    { id: 1, points: "6", outcome: "EXCLUSIVE_BONUS" },
    { id: 2, points: "0", outcome: "NORMAL" },
  ]);
  assert.deepEqual(points(2, [
    { teamAnswerId: 1, status: "CORRECT", isStopper: true, isFinalSubmission: true },
    { teamAnswerId: 2, status: "CORRECT", isStopper: false, isFinalSubmission: true },
  ]), [
    { id: 1, points: "2", outcome: "NORMAL" },
    { id: 2, points: "2", outcome: "NORMAL" },
  ]);
  assert.deepEqual(points(2, [
    { teamAnswerId: 1, status: "WRONG", isStopper: true, isFinalSubmission: true },
    { teamAnswerId: 2, status: "CORRECT", isStopper: false, isFinalSubmission: true },
  ]), [
    { id: 1, points: "-1", outcome: "WRONG_STOP" },
    { id: 2, points: "2", outcome: "NORMAL" },
  ]);
  assert.deepEqual(points(3, [
    { teamAnswerId: 1, status: "CORRECT", isStopper: false, isFinalSubmission: true },
    { teamAnswerId: 2, status: "REVIEW_REQUIRED", isStopper: false, isFinalSubmission: true },
  ]), [
    { id: 1, points: "0", outcome: "PENDING" },
    { id: 2, points: "0", outcome: "PENDING" },
  ]);
});

test("pixel scoring defers every final allocation until all final submissions are evaluated", () => {
  assert.deepEqual(points(1, [
    { teamAnswerId: 1, status: "CORRECT", isStopper: true, isFinalSubmission: true },
    { teamAnswerId: 2, status: "REVIEW_REQUIRED", isStopper: false, isFinalSubmission: true },
  ]), [
    { id: 1, points: "0", outcome: "PENDING" },
    { id: 2, points: "0", outcome: "PENDING" },
  ]);
});
