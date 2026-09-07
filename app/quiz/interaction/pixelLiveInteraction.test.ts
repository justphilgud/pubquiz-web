import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readPixelStageHistory, snapshotPixelStage } from "./pixelStageHistory";
import { completedPixelStages, pixelStageEnd, pixelAnswerDeadline, readPixelLiveConfigSnapshot } from "./pixelLiveInteraction";
import { normalizeQuestionTemplateConfig } from "../../fragen/editor/pixelTemplateConfig";

import {
  allocatePixelQuestionPoints,
  allocatePixelQuestionPointsByRun,
  canStopPixelQuestion,
  createPixelLiveConfigSnapshot,
  pixelRuntimeStageToMediaSlot,
  resolvePixelCountdownSeconds,
  resolvePixelAnswerActionPolicy,
  resolveEffectivePixelStage,
  resolvePixelTeamWriteAccess,
  shouldReuseStoppedPixelRunOnQuestionReentry,
} from "./pixelLiveInteraction";

test("presentation countdown derives from the server deadline and never becomes negative", () => {
  const now = new Date("2026-08-17T18:00:00.000Z").getTime();
  assert.equal(resolvePixelCountdownSeconds("2026-08-17T18:00:20.000Z", now), 20);
  assert.equal(resolvePixelCountdownSeconds("2026-08-17T17:59:59.000Z", now), 0);
  assert.equal(resolvePixelCountdownSeconds(null, now), null);
});

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

test("general close preserves pixel stop authority and never simulates another stop", () => {
  const service = readFileSync(
    "app/quiz/interaction/interaction.server.ts",
    "utf8",
  );
  const closeRun = service.slice(
    service.indexOf("async function closeRun"),
    service.indexOf("export async function syncInteractionForPresentation"),
  );

  assert.match(
    closeRun,
    /await autoFinalizeDrafts\(db, run, options\.reason, \{[\s\S]*!isPixelInteractionRun\(run\)/,
  );
  assert.match(closeRun, /isPixelInteractionRun\(run\) \? "PIXEL" : "DEFAULT"/);
  assert.match(closeRun, /deadline_at: run\.stopped_at \? run\.deadline_at : null/);
  assert.doesNotMatch(closeRun, /stopped_by_team_session_id\s*:/);
  assert.doesNotMatch(closeRun, /stopped_at_stage\s*:/);
  assert.doesNotMatch(closeRun, /quiz_interaction_runs\.create/);
  assert.doesNotMatch(closeRun, /startInteractionCountdown|deadlineAt/);
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

const stagedConfig = createPixelLiveConfigSnapshot({
  pixelMode: "STAGED", stageDurationsSeconds: { stage3: 99, stage2: 99, stage1: 99 },
  createPixelQuestionByAnswer: { answer1: false, answer2: false },
});

test("AP3 modes persist explicitly, legacy remains Challenge, staged duration is fixed", () => {
  assert.equal(createPixelLiveConfigSnapshot(null).mode, "CHALLENGE");
  assert.equal(readPixelLiveConfigSnapshot({ liveInteraction: { ...stagedConfig, mode: undefined } })?.mode, "CHALLENGE");
  assert.equal(normalizeQuestionTemplateConfig({ pixelMode: "STAGED" }, "pixelbild")?.pixelMode, "STAGED");
  assert.equal(normalizeQuestionTemplateConfig({ pixelMode: "INVALID" }, "pixelbild"), null);
  assert.deepEqual(stagedConfig.stageDurationSeconds, { 1: 20, 2: 20, 3: 20 });
  assert.equal(canStopPixelQuestion({ mode: "STAGED", state: "OPEN", stage: 1, stopped: false, hasDraftContent: true, isStopper: false }), false);
  assert.deepEqual(resolvePixelAnswerActionPolicy({ mode: "STAGED", state: "OPEN", stage: 1, stopped: false, isStopper: false, canSubmit: true }), { showStopAndSubmit: false, showNormalSubmit: true });
});

test("AP3 A–K: boundary history and fixed points use only the final answer", () => {
  const scenarios = [
    { texts: ["Eiffelturm", "Eiffelturm", "Eiffelturm"], stage: 3, points: 3 },
    { texts: [null, "Eiffelturm", "Eiffelturm"], stage: 2, points: 2 },
    { texts: ["Fernsehturm", "Eiffelturm", "Eiffelturm"], stage: 2, points: 2 },
    { texts: ["Fernsehturm", "Fernsehturm", "Eiffelturm"], stage: 1, points: 1 },
    { texts: ["Fernsehturm", "Big Ben", "Eiffelturm"], stage: 1, points: 1 },
    { texts: ["Eiffelturm", "  EIFFELTURM ", "Eiffelturm"], stage: 3, points: 3 },
    { texts: [null, null, null], stage: null, points: 0 },
    { texts: ["Big Ben", "Big Ben", "Big Ben"], stage: 3, points: 0 },
    { texts: ["Eiffelturm", "Eiffelturm", "Big Ben"], stage: 1, points: 0 },
    { texts: ["Eiffelturm", null, "Eiffelturm"], stage: 1, points: 1 },
    { texts: ["Eiffelturm", null, null], stage: null, points: 0 },
  ];
  for (const scenario of scenarios) {
    let history = readPixelStageHistory(null);
    scenario.texts.forEach((text, index) => {
      history = snapshotPixelStage(history, (3 - index) as 1 | 2 | 3, text, `2026-09-07T18:00:${index}0.000Z`);
      history = readPixelStageHistory(JSON.parse(JSON.stringify(history))); // reload/reconnect
    });
    assert.equal(history.relevantStage, scenario.stage);
    assert.equal(history.snapshots.length, 3);
    assert.deepEqual(snapshotPixelStage(history, 1, "late write", "2026-09-07T19:00:00Z"), history);
    const last = scenario.texts.at(-1);
    const allocation = allocatePixelQuestionPointsByRun({
      runs: [{ ...pixelRun(3, 3, null), configSnapshot: { liveInteraction: stagedConfig } }],
      evaluations: [{ teamAnswerId: 1, quizTeamSessionId: 101, interactionRunId: 3,
        relevantStage: history.relevantStage, isFinalSubmission: Boolean(last),
        status: last?.trim().toLowerCase() === "eiffelturm" ? "CORRECT" : last ? "WRONG" : "UNANSWERED" }],
    });
    assert.equal(allocation[0].points, scenario.points);
    assert.equal(allocation[0].stage, scenario.stage);
  }
});

test("AP3 three independent teams score 3/2/1 without pending peers affecting each other", () => {
  const allocations = allocatePixelQuestionPointsByRun({
    runs: [{ ...pixelRun(3, 3, null), configSnapshot: { liveInteraction: stagedConfig } }],
    evaluations: ([3, 2, 1] as const).map((stage) => ({ teamAnswerId: stage, quizTeamSessionId: stage,
      interactionRunId: 3, relevantStage: stage, isFinalSubmission: true, status: "CORRECT" })),
  });
  assert.deepEqual(allocations.map((entry) => entry.points), [3, 2, 1]);
});

test("AP3 L: absolute stage boundaries survive reload and catch up without resetting time", () => {
  const openedAt = new Date("2026-09-07T18:00:00Z");
  for (const [elapsed, completed, stage] of [[0, 0, 1], [19_999, 0, 1], [20_000, 1, 2], [33_000, 1, 2], [40_000, 2, 3], [60_000, 2, 3], [90_000, 2, 3], [160_000, 2, 3], [86_400_000, 2, 3]] as const) {
    const now = new Date(openedAt.getTime() + elapsed);
    assert.equal(completedPixelStages(openedAt, stagedConfig, now), completed);
    assert.equal(resolveEffectivePixelStage({ openedAt, config: stagedConfig, serverNow: now }), stage);
  }
  assert.equal(resolvePixelCountdownSeconds(pixelStageEnd(openedAt, stagedConfig, 2)?.toISOString() ?? null, openedAt.getTime() + 33_000), 7);
});


test("B09 A-D/F: visible stage 1 has no deadline, including persisted configuration after reload", () => {
  const openedAt = new Date("2026-09-07T18:00:00Z");
  const config = readPixelLiveConfigSnapshot(JSON.parse(JSON.stringify({ liveInteraction: stagedConfig })))!;
  assert.equal(pixelStageEnd(openedAt, config, 1)?.getTime(), openedAt.getTime() + 20_000);
  assert.equal(pixelStageEnd(openedAt, config, 2)?.getTime(), openedAt.getTime() + 40_000);
  assert.equal(pixelStageEnd(openedAt, config, 3), null);
  assert.equal(pixelAnswerDeadline({ openedAt, config, stoppedAt: null, deadlineAt: null }), null);
  assert.equal(resolvePixelCountdownSeconds(null, openedAt.getTime() + 160_000), null);
  const challenge = createPixelLiveConfigSnapshot(null);
  assert.equal(pixelAnswerDeadline({ openedAt, config: challenge, stoppedAt: null, deadlineAt: null })?.getTime(), openedAt.getTime() + 45_000);
  const stoppedAt = new Date(openedAt.getTime() + 10_000);
  const deadlineAt = new Date(stoppedAt.getTime() + 20_000);
  assert.equal(pixelAnswerDeadline({ openedAt, config: challenge, stoppedAt, deadlineAt }), deadlineAt);
});

test("B09 E/G/H: manual closing snapshots late first/changed answers without time reducing points", () => {
  for (const elapsed of [45_000, 90_000, 160_000]) {
    for (const [early, last, expected] of [[null, "Frosch", 1], ["Katze", "Frosch", 1], ["Frosch", "Katze", 0], ["Frosch", "Frosch", 3]] as const) {
      const openedAt = new Date("2026-09-07T18:00:00Z");
      let history = snapshotPixelStage(readPixelStageHistory(null), 3, early, new Date(openedAt.getTime() + 20_000).toISOString());
      history = snapshotPixelStage(history, 2, early, new Date(openedAt.getTime() + 40_000).toISOString());
      history = readPixelStageHistory(JSON.parse(JSON.stringify(history)));
      assert.equal(history.snapshots.length, 2); // Reload never finalizes the open last stage.
      assert.equal(completedPixelStages(openedAt, stagedConfig, new Date(openedAt.getTime() + elapsed)), 2);
      history = snapshotPixelStage(history, 1, last, new Date(openedAt.getTime() + elapsed).toISOString());
      const [allocation] = allocatePixelQuestionPointsByRun({
        runs: [{ ...pixelRun(3, 3, null), configSnapshot: { liveInteraction: stagedConfig } }],
        evaluations: [{ teamAnswerId: 1, quizTeamSessionId: 101, interactionRunId: 3,
          relevantStage: history.relevantStage, isFinalSubmission: true, status: last === "Frosch" ? "CORRECT" : "WRONG" }],
      });
      assert.equal(allocation.points, expected);
      assert.equal(history.snapshots.length, 3);
    }
  }
});
