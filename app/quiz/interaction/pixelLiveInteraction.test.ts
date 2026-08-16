import assert from "node:assert/strict";
import test from "node:test";

import {
  allocatePixelQuestionPoints,
  allocatePixelQuestionPointsByRun,
  canStopPixelQuestion,
  createPixelLiveConfigSnapshot,
  pixelRuntimeStageToMediaSlot,
  resolvePixelAnswerActionPolicy,
  resolveEffectivePixelStage,
  resolvePixelTeamWriteAccess,
  shouldReuseStoppedPixelRunOnQuestionReentry,
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

test("pixel editing stays available on mobile policy until stop deadline", () => {
  const now = new Date("2026-08-15T18:00:00.000Z");
  assert.deepEqual(resolvePixelTeamWriteAccess({
    state: "OPEN",
    deadlineAt: null,
    serverNow: now,
    isStopper: false,
  }), { canEdit: true, canSubmit: true });
  assert.deepEqual(resolvePixelTeamWriteAccess({
    state: "COUNTDOWN",
    deadlineAt: new Date(now.getTime() + 20_000),
    serverNow: now,
    isStopper: false,
  }), { canEdit: true, canSubmit: true });
  assert.deepEqual(resolvePixelTeamWriteAccess({
    state: "COUNTDOWN",
    deadlineAt: new Date(now.getTime() + 20_000),
    serverNow: now,
    isStopper: true,
  }), { canEdit: false, canSubmit: false });
  assert.deepEqual(resolvePixelTeamWriteAccess({
    state: "COUNTDOWN",
    deadlineAt: new Date(now.getTime() - 1),
    serverNow: now,
    isStopper: false,
  }), { canEdit: false, canSubmit: false });
});

test("pixel answer actions expose exactly one primary path per lifecycle phase", () => {
  assert.deepEqual(resolvePixelAnswerActionPolicy({
    state: "OPEN",
    stage: 1,
    stopped: false,
    isStopper: false,
    canSubmit: true,
  }), { showStopAndSubmit: true, showNormalSubmit: false });
  assert.deepEqual(resolvePixelAnswerActionPolicy({
    state: "OPEN",
    stage: 3,
    stopped: false,
    isStopper: false,
    canSubmit: true,
  }), { showStopAndSubmit: false, showNormalSubmit: true });
  assert.deepEqual(resolvePixelAnswerActionPolicy({
    state: "COUNTDOWN",
    stage: 2,
    stopped: true,
    isStopper: false,
    canSubmit: true,
  }), { showStopAndSubmit: false, showNormalSubmit: true });
  assert.deepEqual(resolvePixelAnswerActionPolicy({
    state: "COUNTDOWN",
    stage: 2,
    stopped: true,
    isStopper: true,
    canSubmit: false,
  }), { showStopAndSubmit: false, showNormalSubmit: false });
});

test("stopped terminal pixel runs remain authoritative on question re-entry", () => {
  const configSnapshot = {
    liveInteraction: createPixelLiveConfigSnapshot(null),
  };
  assert.equal(shouldReuseStoppedPixelRunOnQuestionReentry({
    state: "CLOSED",
    configSnapshot,
    stoppedAt: new Date("2026-08-15T18:00:05.000Z"),
    stoppedAtStage: 1,
  }), true);
  assert.equal(shouldReuseStoppedPixelRunOnQuestionReentry({
    state: "REVEALED",
    configSnapshot,
    stoppedAt: new Date("2026-08-15T18:00:20.000Z"),
    stoppedAtStage: 2,
  }), true);
  assert.equal(shouldReuseStoppedPixelRunOnQuestionReentry({
    state: "CLOSED",
    configSnapshot,
    stoppedAt: null,
    stoppedAtStage: null,
  }), false);
  assert.equal(shouldReuseStoppedPixelRunOnQuestionReentry({
    state: "CLOSED",
    configSnapshot: { interaction: { type: "TEXT" } },
    stoppedAt: new Date("2026-08-15T18:00:05.000Z"),
    stoppedAtStage: 1,
  }), false);
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

function pixelRun(
  interactionRunId: number,
  stage: 1 | 2 | 3,
  stoppedByTeamSessionId: number | null,
) {
  const openedAt = new Date("2026-08-15T18:00:00.000Z");
  return {
    interactionRunId,
    openedAt,
    stoppedAt: stage < 3 ? new Date(openedAt.getTime() + 1_000) : null,
    closedAt: new Date(openedAt.getTime() + (stage === 3 ? 31_000 : 2_000)),
    stoppedAtStage: stage < 3 ? stage : null,
    stoppedByTeamSessionId,
    configSnapshot: {
      liveInteraction: createPixelLiveConfigSnapshot(null),
    },
  };
}

function runBoundPoints(input: {
  stage: 1 | 2 | 3;
  statuses: readonly ["CORRECT" | "WRONG", "CORRECT" | "WRONG"];
}) {
  const run = pixelRun(3, input.stage, input.stage < 3 ? 101 : null);
  return allocatePixelQuestionPointsByRun({
    runs: [run],
    evaluations: input.statuses.map((status, index) => ({
      teamAnswerId: index + 1,
      quizTeamSessionId: 101 + index,
      interactionRunId: run.interactionRunId,
      status,
      isFinalSubmission: true,
    })),
  }).map((entry) => entry.points);
}

test("run-bound scoring ignores a newer empty reopen run", () => {
  const allocations = allocatePixelQuestionPointsByRun({
    runs: [pixelRun(3, 1, 101), pixelRun(4, 3, null)],
    evaluations: [
      {
        teamAnswerId: 1,
        quizTeamSessionId: 101,
        interactionRunId: 3,
        status: "CORRECT",
        isFinalSubmission: true,
      },
      {
        teamAnswerId: 2,
        quizTeamSessionId: 102,
        interactionRunId: 3,
        status: "WRONG",
        isFinalSubmission: true,
      },
    ],
  });

  assert.deepEqual(allocations.map((entry) => entry.points), [6, 0]);
  assert.deepEqual(allocations.map((entry) => entry.stage), [1, 1]);
  assert.equal(allocations[0]?.isStopper, true);
  assert.equal(allocations[0]?.outcome, "EXCLUSIVE_BONUS");
});

test("submission-based scoring never falls back to an unrelated latest run", () => {
  assert.deepEqual(allocatePixelQuestionPointsByRun({
    runs: [pixelRun(4, 3, null)],
    evaluations: [{
      teamAnswerId: 1,
      quizTeamSessionId: 101,
      interactionRunId: 3,
      status: "CORRECT",
      isFinalSubmission: true,
    }],
  }), []);
});

test("run-bound scoring preserves the complete pixel points matrix", () => {
  const matrix = [
    { stage: 1, statuses: ["CORRECT", "WRONG"], points: [6, 0] },
    { stage: 2, statuses: ["CORRECT", "WRONG"], points: [4, 0] },
    { stage: 1, statuses: ["WRONG", "CORRECT"], points: [-1, 3] },
    { stage: 2, statuses: ["WRONG", "CORRECT"], points: [-1, 2] },
    { stage: 1, statuses: ["CORRECT", "CORRECT"], points: [3, 3] },
    { stage: 2, statuses: ["CORRECT", "CORRECT"], points: [2, 2] },
    { stage: 3, statuses: ["CORRECT", "WRONG"], points: [1, 0] },
  ] as const;

  for (const entry of matrix) {
    assert.deepEqual(
      runBoundPoints({ stage: entry.stage, statuses: entry.statuses }),
      entry.points,
    );
  }
});
