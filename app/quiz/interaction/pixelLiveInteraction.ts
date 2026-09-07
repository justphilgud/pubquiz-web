import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import { isQuizInteractionWritable } from "./interactionStateMachine";

export const PIXEL_LIVE_INTERACTION_TYPE = "PIXEL_STOP" as const;
export const PIXEL_STAGE_COUNT = 3 as const;
export const PIXEL_STOP_COUNTDOWN_SECONDS = 20 as const;
export const PIXEL_NORMAL_POINTS = [3, 2, 1] as const;
export const PIXEL_EXCLUSIVE_BONUS_POINTS = [6, 4, null] as const;
export const PIXEL_WRONG_STOP_POINTS = -1 as const;

export function resolvePixelCountdownSeconds(
  submissionDeadlineAt: string | null,
  serverNow: number,
) {
  if (!submissionDeadlineAt) return null;
  return Math.max(
    0,
    Math.ceil((new Date(submissionDeadlineAt).getTime() - serverNow) / 1_000),
  );
}

export type PixelRuntimeStage = 1 | 2 | 3;

export function pixelStageEnd(openedAt: Date | string, config: PixelLiveConfigSnapshot, stage: PixelRuntimeStage) {
  // Runtime stage 3 is visible stage 1; its stored legacy duration is ignored.
  if (config.mode === "STAGED" && stage === 3) return null;
  let seconds = 0;
  for (let index = 1; index <= stage; index++) seconds += config.stageDurationSeconds[index as PixelRuntimeStage];
  return new Date(new Date(openedAt).getTime() + seconds * 1_000);
}

export function completedPixelStages(openedAt: Date | null, config: PixelLiveConfigSnapshot, now: Date) {
  if (!openedAt || config.mode !== "STAGED") return 0;
  return ([1, 2, 3] as const).filter((stage) => {
    const end = pixelStageEnd(openedAt, config, stage);
    return end !== null && end <= now;
  }).length;
}

export function pixelAnswerDeadline(input: {
  openedAt: Date | null; config: PixelLiveConfigSnapshot;
  stoppedAt: Date | null; deadlineAt: Date | null;
}) {
  if (input.config.mode === "STAGED") return null;
  return input.stoppedAt ? input.deadlineAt
    : input.openedAt ? pixelStageEnd(input.openedAt, input.config, 3) : null;
}

export type PixelLiveConfigSnapshot = {
  mode: "CHALLENGE" | "STAGED";
  type: typeof PIXEL_LIVE_INTERACTION_TYPE;
  stageDurationSeconds: Record<PixelRuntimeStage, number>;
  stageCount: typeof PIXEL_STAGE_COUNT;
  normalPoints: typeof PIXEL_NORMAL_POINTS;
  stopCountdownSeconds: typeof PIXEL_STOP_COUNTDOWN_SECONDS;
  exclusiveBonusPoints: typeof PIXEL_EXCLUSIVE_BONUS_POINTS;
  wrongStopPoints: typeof PIXEL_WRONG_STOP_POINTS;
};

export type PixelLiveState = {
  mode?: "CHALLENGE" | "STAGED";
  stageDeadlineAt?: string | null;
  interactionType: typeof PIXEL_LIVE_INTERACTION_TYPE;
  state: "LOCKED" | "OPEN" | "COUNTDOWN" | "CLOSED" | "REVEALED";
  effectivePixelStage: PixelRuntimeStage;
  stopped: boolean;
  stoppedByTeamName: string | null;
  stoppedAt: string | null;
  stoppedAtStage: PixelRuntimeStage | null;
  submissionDeadlineAt: string | null;
  resolution: {
    answer: string | null;
    status: "CORRECT" | "WRONG" | "PARTIAL" | "REVIEW_REQUIRED" | "UNANSWERED";
    points: string;
    outcome: "NORMAL" | "EXCLUSIVE_BONUS" | "WRONG_STOP" | "PENDING" | null;
  } | null;
};

export function isPixelStageOpenEnded(state: PixelLiveState | null | undefined) {
  return state?.mode === "STAGED" && state.state === "OPEN" &&
    state.effectivePixelStage === 3 && !state.stopped;
}

export const PIXEL_OPEN_STAGE_LABEL = "Offen bis zum Abschluss durch Moderation";

const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 120;

function validDuration(value: unknown, fallback = 15) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_DURATION_SECONDS &&
    value <= MAX_DURATION_SECONDS
    ? value
    : fallback;
}

/**
 * Generator slots use their historic visual-strength names. Runtime stages are
 * chronological: stage 1 is the strongest pixelation and stage 3 the clearest.
 */
export function createPixelLiveConfigSnapshot(
  templateConfig: QuestionTemplateConfig | null | undefined,
): PixelLiveConfigSnapshot {
  const durations = templateConfig?.stageDurationsSeconds;
  return {
    mode: templateConfig?.pixelMode ?? "CHALLENGE",
    type: PIXEL_LIVE_INTERACTION_TYPE,
    stageDurationSeconds: {
      1: templateConfig?.pixelMode === "STAGED" ? 20 : validDuration(durations?.stage3),
      2: templateConfig?.pixelMode === "STAGED" ? 20 : validDuration(durations?.stage2),
      3: templateConfig?.pixelMode === "STAGED" ? 20 : validDuration(durations?.stage1),
    },
    stageCount: PIXEL_STAGE_COUNT,
    normalPoints: PIXEL_NORMAL_POINTS,
    stopCountdownSeconds: PIXEL_STOP_COUNTDOWN_SECONDS,
    exclusiveBonusPoints: PIXEL_EXCLUSIVE_BONUS_POINTS,
    wrongStopPoints: PIXEL_WRONG_STOP_POINTS,
  };
}

export function readPixelLiveConfigSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { liveInteraction?: unknown };
  const live = candidate.liveInteraction;
  if (!live || typeof live !== "object" || Array.isArray(live)) return null;
  const typed = live as Partial<PixelLiveConfigSnapshot>;
  if (typed.type !== PIXEL_LIVE_INTERACTION_TYPE) return null;
  const durations = typed.stageDurationSeconds;
  if (!durations || typeof durations !== "object") return null;
  return {
    ...createPixelLiveConfigSnapshot(null),
    mode: typed.mode === "STAGED" ? "STAGED" : "CHALLENGE",
    stageDurationSeconds: {
      1: typed.mode === "STAGED" ? 20 : validDuration(durations[1]),
      2: typed.mode === "STAGED" ? 20 : validDuration(durations[2]),
      3: typed.mode === "STAGED" ? 20 : validDuration(durations[3]),
    },
  } satisfies PixelLiveConfigSnapshot;
}

export function resolveEffectivePixelStage(input: {
  openedAt: Date | string | null;
  serverNow: Date | string;
  config: PixelLiveConfigSnapshot;
  stoppedAtStage?: number | null;
}): PixelRuntimeStage {
  if (input.stoppedAtStage === 1 || input.stoppedAtStage === 2) {
    return input.stoppedAtStage;
  }
  if (!input.openedAt) return 1;
  const elapsedMs = Math.max(
    0,
    new Date(input.serverNow).getTime() - new Date(input.openedAt).getTime(),
  );
  const stage1End = input.config.stageDurationSeconds[1] * 1_000;
  const stage2End =
    stage1End + input.config.stageDurationSeconds[2] * 1_000;
  if (elapsedMs < stage1End) return 1;
  if (elapsedMs < stage2End) return 2;
  return 3;
}

export function canStopPixelQuestion(input: {
  mode?: "CHALLENGE" | "STAGED";
  state: string;
  stage: PixelRuntimeStage;
  stopped: boolean;
  hasDraftContent: boolean;
  isStopper: boolean;
}) {
  return input.mode !== "STAGED" && input.state === "OPEN" &&
    input.stage < 3 &&
    !input.stopped &&
    input.hasDraftContent &&
    !input.isStopper;
}

export function resolvePixelAnswerActionPolicy(input: {
  mode?: "CHALLENGE" | "STAGED";
  state: PixelLiveState["state"];
  stage: PixelRuntimeStage;
  stopped: boolean;
  isStopper: boolean;
  canSubmit: boolean;
}) {
  const showStopAndSubmit =
    input.mode !== "STAGED" &&
    input.state === "OPEN" &&
    input.stage < 3 &&
    !input.stopped &&
    !input.isStopper;

  return {
    showStopAndSubmit,
    showNormalSubmit: input.canSubmit && !showStopAndSubmit,
  };
}

export function shouldReuseStoppedPixelRunOnQuestionReentry(input: {
  state: string;
  configSnapshot: unknown;
  stoppedAt: Date | string | null;
  stoppedAtStage: number | null;
}) {
  return (
    (input.state === "CLOSED" || input.state === "REVEALED") &&
    readPixelLiveConfigSnapshot(input.configSnapshot) !== null &&
    input.stoppedAt !== null &&
    (input.stoppedAtStage === 1 || input.stoppedAtStage === 2)
  );
}

export function resolvePixelTeamWriteAccess(input: {
  state: "LOCKED" | "OPEN" | "COUNTDOWN" | "CLOSED" | "REVEALED";
  deadlineAt: Date | null;
  serverNow: Date;
  isStopper: boolean;
}) {
  const writable = isQuizInteractionWritable(
    input.state,
    input.deadlineAt,
    input.serverNow,
  ) && !input.isStopper;
  return { canEdit: writable, canSubmit: writable };
}

export function pixelRuntimeStageToMediaSlot(stage: PixelRuntimeStage) {
  return stage === 1
    ? "pixel_stage_3_image"
    : stage === 2
      ? "pixel_stage_2_image"
      : "pixel_stage_1_image";
}

export type PixelEvaluationInput = {
  teamAnswerId: number;
  status: "UNANSWERED" | "REVIEW_REQUIRED" | "CORRECT" | "PARTIAL" | "WRONG";
  isStopper: boolean;
  isFinalSubmission: boolean;
};

export type PixelEvaluationRunInput = {
  interactionRunId: number;
  openedAt: Date | string | null;
  stoppedAt: Date | string | null;
  closedAt: Date | string | null;
  stoppedAtStage: number | null;
  stoppedByTeamSessionId: number | null;
  configSnapshot: unknown;
};

export type PixelRunBoundEvaluationInput = Omit<
  PixelEvaluationInput,
  "isStopper"
> & {
  relevantStage?: 1 | 2 | 3 | null;
  quizTeamSessionId: number;
  interactionRunId: number | null;
};

export function allocatePixelQuestionPoints(input: {
  stage: PixelRuntimeStage;
  evaluations: readonly PixelEvaluationInput[];
}) {
  const correctCount = input.evaluations.filter(
    (entry) => entry.status === "CORRECT",
  ).length;
  const hasPendingFinalSubmission = input.evaluations.some(
    (entry) => entry.isFinalSubmission && entry.status === "REVIEW_REQUIRED",
  );
  const normal = PIXEL_NORMAL_POINTS[input.stage - 1];
  return input.evaluations.map((entry) => {
    let points = 0;
    let outcome: "NORMAL" | "EXCLUSIVE_BONUS" | "WRONG_STOP" | "PENDING" =
      "NORMAL";
    if (
      ["UNANSWERED", "REVIEW_REQUIRED"].includes(entry.status) ||
      (entry.isFinalSubmission && hasPendingFinalSubmission)
    ) {
      outcome = "PENDING";
    } else if (entry.isStopper && entry.status !== "CORRECT") {
      points = PIXEL_WRONG_STOP_POINTS;
      outcome = "WRONG_STOP";
    } else if (entry.status === "CORRECT") {
      const exclusive = entry.isStopper && correctCount === 1
        ? PIXEL_EXCLUSIVE_BONUS_POINTS[input.stage - 1]
        : null;
      if (exclusive !== null) {
        points = exclusive;
        outcome = "EXCLUSIVE_BONUS";
      } else {
        points = normal;
      }
    }
    return {
      teamAnswerId: entry.teamAnswerId,
      points,
      outcome,
      stage: input.stage,
      correctCount,
      isStopper: entry.isStopper,
    };
  });
}

export function allocatePixelQuestionPointsByRun(input: {
  runs: readonly PixelEvaluationRunInput[];
  evaluations: readonly PixelRunBoundEvaluationInput[];
}) {
  const evaluationsByRunId = new Map<number, PixelRunBoundEvaluationInput[]>();
  for (const evaluation of input.evaluations) {
    if (evaluation.interactionRunId === null) continue;
    const runEvaluations = evaluationsByRunId.get(evaluation.interactionRunId);
    if (runEvaluations) {
      runEvaluations.push(evaluation);
    } else {
      evaluationsByRunId.set(evaluation.interactionRunId, [evaluation]);
    }
  }

  return input.runs.flatMap<Omit<ReturnType<typeof allocatePixelQuestionPoints>[number], "stage"> & { stage: PixelRuntimeStage | null }>((run) => {
    const evaluations = evaluationsByRunId.get(run.interactionRunId);
    if (!evaluations) return [];
    const config = readPixelLiveConfigSnapshot(run.configSnapshot);
    if (!config) return [];
    if (config.mode === "STAGED") return evaluations.map((entry) => ({
      teamAnswerId: entry.teamAnswerId,
      points: entry.status === "CORRECT" ? entry.relevantStage ?? 0 : 0,
      outcome: entry.status === "REVIEW_REQUIRED" ? "PENDING" as const : "NORMAL" as const,
      stage: entry.relevantStage ?? null,
      correctCount: evaluations.filter((item) => item.status === "CORRECT").length,
      isStopper: false,
    }));
    const stage = resolveEffectivePixelStage({
      openedAt: run.openedAt,
      serverNow: run.stoppedAt ?? run.closedAt ?? new Date(),
      config,
      stoppedAtStage: run.stoppedAtStage,
    });
    return allocatePixelQuestionPoints({
      stage,
      evaluations: evaluations.map((evaluation) => ({
        teamAnswerId: evaluation.teamAnswerId,
        status: evaluation.status,
        isFinalSubmission: evaluation.isFinalSubmission,
        isStopper:
          run.stoppedByTeamSessionId === evaluation.quizTeamSessionId,
      })),
    });
  });
}
