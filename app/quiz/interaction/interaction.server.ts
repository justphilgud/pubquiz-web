import { Prisma } from "@/app/generated/prisma/client";
import type { ResolvedQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import { resolveQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import { hasAnswerContentChanged } from "@/app/quiz/evaluation/answerContent";
import {
  recalculateQuizAnswerEvaluation,
  recalculateQuizQuestionEvaluation,
} from "@/app/quiz/evaluation/evaluation.server";
import { resolveQuizQuestionAnswerMode } from "@/app/quiz/quizQuestionAnswerMode";
import { resolveQuizSpecificOrderingParticipantItems } from "@/app/quiz/orderingQuestionOrder";
import { repairQuizSpecificOrderingAssignments } from "@/app/quiz/orderingQuestionOrder.server";
import { isQuizAnswerRunReleasedForWrite } from "@/app/quiz/quizAnswerLiveState";
import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import { prisma } from "@/app/lib/prisma";
import { mapTeamProfile } from "@/app/teams/teamProfile";
import {
  isQuizQuestionBlockOpen,
  serializeQuizParticipantLiveRevision,
} from "@/app/quiz/quizBlockLiveState";
import { parsePresentationSlideKey } from "@/app/rendering/presentation/presentationLiveState";
import {
  type QuizInteractionPayload,
  type TeamAnswerDraftInput,
  validateInteractionPayload,
} from "./interactionPayload";
import {
  assertQuizInteractionTransition,
  isQuizInteractionWritable,
  type QuizInteractionState,
} from "./interactionStateMachine";
import {
  isDraftEligibleForAuthoritativeLiveRun,
  planSubmissionVersion,
  resolveInteractionClosePolicy,
  resolveInteractionSubmissionPolicy,
  shouldKeepInteractionOpenUntilBlockClose,
  shouldAutoFinalizeDraft,
} from "./interactionSubmissionPolicy";
import {
  canStopPixelQuestion,
  createPixelLiveConfigSnapshot,
  readPixelLiveConfigSnapshot,
  resolveEffectivePixelStage,
  resolvePixelTeamWriteAccess,
  shouldReuseStoppedPixelRunOnQuestionReentry,
} from "./pixelLiveInteraction";
import {
  aggregatePollSubmissions,
  isPollInteractionType,
  type PollInteraction,
} from "./pollInteraction";
import {
  aggregateLiveChoiceResults,
  isLiveChoiceInteraction,
} from "@/app/quiz/liveResults/liveChoiceResults";
import { aggregateLiveTextResults } from "@/app/quiz/liveResults/liveTextResults";
import { selectEffectiveLiveSubmissions } from "@/app/quiz/liveResults/effectiveLiveSubmissions";
import {
  canIncludeLiveResultAggregates,
  isLiveResultVisibleToAudience,
} from "@/app/quiz/liveResults/liveResultControls";
import { shouldReuseQuestionInteractionRun } from "./interactionRunReuse";
import {
  buildLivePollRunSnapshot,
  getLivePollStateForRun,
  loadLivePollPlacement,
  readLivePollRunSnapshot,
} from "@/app/umfragen/livePollRuntime.server";

type DbClient = Prisma.TransactionClient;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readInteractionSnapshot(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Interaction-Snapshot ist ung\u00fcltig.");
  }
  const interaction = (value as { interaction?: unknown }).interaction;
  if (!interaction || typeof interaction !== "object" || !("type" in interaction)) {
    throw new Error("Interaction-Snapshot enth\u00e4lt keinen Contract.");
  }
  return interaction as ResolvedQuizAnswerInteraction;
}

function buildInteractionConfigSnapshot(input: {
  interaction: ResolvedQuizAnswerInteraction;
  templateId: string | null;
  templateConfig: QuestionTemplateConfig | null;
}) {
  return input.templateId === "pixelbild"
    ? {
        interaction: input.interaction,
        liveInteraction: createPixelLiveConfigSnapshot(input.templateConfig),
      }
    : { interaction: input.interaction };
}

export async function resolveInteractionAssignment(
  db: DbClient | typeof prisma,
  quizId: number,
  quizFragenId: number,
) {
  await repairQuizSpecificOrderingAssignments(quizId, db);
  const assignment = await db.quiz_fragen.findFirst({
    where: { quiz_id: quizId, quiz_fragen_id: quizFragenId },
    include: {
      fragen: {
        include: {
          antworten: {
            include: { antworttyp: true },
            orderBy: { antwort_id: "asc" },
          },
          antwortfelder: { orderBy: { sortierung: "asc" } },
          vorlage: { select: { code: true } },
        },
      },
    },
  });
  if (!assignment) throw new Error("Quizfrage geh\u00f6rt nicht zu diesem Quiz.");

  const answerMode = resolveQuizQuestionAnswerMode({
    templateId: assignment.fragen.vorlage?.code ?? null,
    answers: assignment.fragen.antworten.map((answer) => ({
      isCorrect: answer.ist_richtig,
    })),
    allowFreeAnswer: assignment.freie_antwort_erlaubt,
  });
  const templateConfig = assignment.fragen.template_config_json as
    | QuestionTemplateConfig
    | null;
  const sortedAnswers = [...assignment.fragen.antworten].sort((left, right) => {
    const leftIndex = assignment.antwort_reihenfolge.indexOf(left.antwort_id);
    const rightIndex = assignment.antwort_reihenfolge.indexOf(right.antwort_id);
    if (leftIndex < 0 && rightIndex < 0) return left.antwort_id - right.antwort_id;
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    return leftIndex - rightIndex;
  });
  const orderingItems =
    templateConfig?.templateData?.kind === "ORDERING"
      ? resolveQuizSpecificOrderingParticipantItems(
          assignment.fragen.antworten,
          assignment.antwort_reihenfolge,
        ) ?? []
      : undefined;
  const interaction = resolveQuizAnswerInteraction({
    templateId: assignment.fragen.vorlage?.code ?? null,
    originalAnswerMode: answerMode.originalMode,
    effectiveAnswerMode: answerMode.effectiveMode,
    templateData: templateConfig?.templateData,
    orderingItems,
    answerFields: assignment.fragen.antwortfelder.map((field) => ({
      id: field.antwortfeld_id,
      label: field.label,
      required: field.ist_pflicht,
    })),
    answerOptions: sortedAnswers
      .filter((answer) => answer.antworttyp.antworttyp !== "Freitext")
      .map((answer) => ({ id: answer.antwort_id, label: answer.antwort })),
  });
  return {
    assignment,
    interaction,
    templateId: assignment.fragen.vorlage?.code ?? null,
    templateConfig,
  };
}

async function lockRun(db: DbClient, interactionRunId: number) {
  await db.$queryRaw`
    SELECT "interaction_run_id"
    FROM "pubquiz"."quiz_interaction_runs"
    WHERE "interaction_run_id" = ${interactionRunId}
    FOR UPDATE
  `;
}

async function lockCurrentRun(db: DbClient, quizId: number) {
  const rows = await db.$queryRaw<{ interaction_run_id: number }[]>`
    SELECT "interaction_run_id"
    FROM "pubquiz"."quiz_interaction_runs"
    WHERE "quiz_id" = ${quizId} AND "is_current" = true
    FOR UPDATE
  `;
  return rows[0]?.interaction_run_id ?? null;
}

function draftInputFromStored(answer: {
  antwort_text: string | null;
  antwort_id: number | null;
  antwortauswahlen: readonly { antwort_id: number }[];
  antwortfelder: readonly { antwortfeld_id: number; antwort_text: string | null }[];
}): TeamAnswerDraftInput {
  return {
    answerText: answer.antwort_text,
    selectedAnswerIds:
      answer.antwortauswahlen.length > 0
        ? answer.antwortauswahlen.map((selection) => selection.antwort_id)
        : answer.antwort_id === null
          ? []
          : [answer.antwort_id],
    structuredAnswers: answer.antwortfelder.map((field) => ({
      fieldId: field.antwortfeld_id,
      answerText: field.antwort_text,
    })),
  };
}

async function autoFinalizeDrafts(
  db: DbClient,
  run: {
    interaction_run_id: number;
    quiz_fragen_id: number | null;
    interaction_type: string;
    config_snapshot: Prisma.JsonValue;
    opened_at: Date | null;
  },
  reason: string,
  options: { reconcileAuthoritativeLiveDrafts?: boolean } = {},
) {
  const interaction = readInteractionSnapshot(run.config_snapshot);
  const candidates = await db.team_antworten.findMany({
    where:
      options.reconcileAuthoritativeLiveDrafts && run.quiz_fragen_id !== null
        ? { quiz_fragen_id: run.quiz_fragen_id }
        : { interaction_run_id: run.interaction_run_id },
    include: { antwortauswahlen: true, antwortfelder: true },
  });
  const drafts = options.reconcileAuthoritativeLiveDrafts
    ? candidates.filter((draft) =>
        isDraftEligibleForAuthoritativeLiveRun({
          draftInteractionRunId: draft.interaction_run_id,
          draftUpdatedAt: draft.draft_updated_at ?? draft.aktualisiert_am,
          authoritativeRunId: run.interaction_run_id,
          authoritativeRunOpenedAt: run.opened_at,
        }),
      )
    : candidates;
  if (drafts.length === 0) return 0;
  if (options.reconcileAuthoritativeLiveDrafts) {
    for (const draft of drafts) {
      if (draft.interaction_run_id === run.interaction_run_id) continue;
      await db.team_antworten.update({
        where: { team_antwort_id: draft.team_antwort_id },
        data: { interaction_run_id: run.interaction_run_id },
      });
    }
  }
  const existing = await db.team_answer_submissions.findMany({
      where: { interaction_run_id: run.interaction_run_id },
      select: {
        quiz_team_session_id: true,
        submission_version: true,
        draft_revision: true,
      },
    });
  const submissions: Prisma.team_answer_submissionsCreateManyInput[] = [];
  for (const draft of drafts) {
    const validated = validateInteractionPayload(
      interaction,
      draftInputFromStored(draft),
    );
    const teamSubmissions = existing.filter(
      (submission) => submission.quiz_team_session_id === draft.quiz_team_session_id,
    );
    if (!shouldAutoFinalizeDraft({
      hasExplicitSubmission: teamSubmissions.some(
        (submission) => submission.draft_revision === draft.draft_revision,
      ),
      hasContent: validated.hasContent,
    })) {
      continue;
    }
    const versionPlan = planSubmissionVersion(
      teamSubmissions.map((submission) => ({
        submissionVersion: submission.submission_version,
        draftRevision: submission.draft_revision,
      })),
      draft.draft_revision,
    );
    if (versionPlan.kind === "IDEMPOTENT") continue;
    submissions.push({
      interaction_run_id: run.interaction_run_id,
      team_antwort_id: draft.team_antwort_id,
      quiz_team_session_id: draft.quiz_team_session_id,
      submission_version: versionPlan.submissionVersion,
      status: "AUTO_FINALIZED",
      interaction_type: run.interaction_type,
      payload: toJson(validated.payload),
      draft_revision: draft.draft_revision,
      finalization_reason: reason,
    });
  }
  if (submissions.length > 0) {
    await db.team_answer_submissions.createMany({
      data: submissions,
      skipDuplicates: true,
    });
  }
  return submissions.length;
}

function isPixelInteractionRun(run: { config_snapshot: Prisma.JsonValue }) {
  return readPixelLiveConfigSnapshot(run.config_snapshot) !== null;
}

function shouldKeepRunOpenUntilBlockClose(run: {
  interaction_type: string;
  config_snapshot: Prisma.JsonValue;
}) {
  return !isPixelInteractionRun(run) &&
    shouldKeepInteractionOpenUntilBlockClose(run.interaction_type);
}

async function deactivateRunWithoutFinalizing(db: DbClient, runId: number) {
  await lockRun(db, runId);
  const run = await db.quiz_interaction_runs.findUnique({
    where: { interaction_run_id: runId },
  });
  if (!run || !run.is_current) return run;
  return db.quiz_interaction_runs.update({
    where: { interaction_run_id: runId },
    data: { is_current: false, revision: { increment: 1 } },
  });
}

async function closeRun(
  db: DbClient,
  runId: number,
  options: {
    reason: string;
    keepCurrent: boolean;
    evaluateFinalizedDrafts?: boolean;
    reconcileAuthoritativeLiveDrafts?: boolean;
  },
) {
  await lockRun(db, runId);
  const run = await db.quiz_interaction_runs.findUnique({
    where: { interaction_run_id: runId },
  });
  if (!run) return null;
  if (run.state === "OPEN" || run.state === "COUNTDOWN") {
    const contentPoll = readLivePollRunSnapshot(run.config_snapshot);
    const finalizedDrafts = contentPoll
      ? 0
      : await autoFinalizeDrafts(db, run, options.reason, {
          reconcileAuthoritativeLiveDrafts:
            options.reconcileAuthoritativeLiveDrafts === true &&
            !isPixelInteractionRun(run),
        });
    const closePolicy = resolveInteractionClosePolicy(
      isPixelInteractionRun(run) ? "PIXEL" : "DEFAULT",
    );
    if (
      run.quiz_fragen_id !== null &&
      finalizedDrafts > 0 &&
      !isPollInteractionType(run.interaction_type) &&
      options.evaluateFinalizedDrafts !== false &&
      closePolicy.evaluateAutoFinalizedDrafts
    ) {
      await recalculateQuizQuestionEvaluation(run.quiz_fragen_id, db);
    }
    assertQuizInteractionTransition(run.state, "CLOSED");
    return db.quiz_interaction_runs.update({
      where: { interaction_run_id: runId },
      data: {
        state: "CLOSED",
        closed_at: run.closed_at ?? new Date(),
        deadline_at: run.stopped_at ? run.deadline_at : null,
        is_current: options.keepCurrent,
        revision: { increment: 1 },
      },
    });
  }
  if (!options.keepCurrent && run.is_current) {
    return db.quiz_interaction_runs.update({
      where: { interaction_run_id: runId },
      data: { is_current: false, revision: { increment: 1 } },
    });
  }
  return run;
}

export async function syncInteractionForPresentation(
  db: DbClient,
  input: {
    quizId: number;
    slideKey: string;
    knownOpenQuizSectionId?: number;
  },
) {
  const currentRunId = await lockCurrentRun(db, input.quizId);
  const identity = parsePresentationSlideKey(input.slideKey);
  if (identity?.kind === "LIVE_POLL") {
    return syncLivePollForPresentation(db, {
      quizId: input.quizId,
      placementId: identity.placementId,
      currentRunId,
    });
  }
  if (identity?.kind !== "QUESTION") {
    if (currentRunId !== null) {
      const currentRun = await db.quiz_interaction_runs.findUnique({
        where: { interaction_run_id: currentRunId },
      });
      if (
        currentRun &&
        !shouldKeepRunOpenUntilBlockClose(currentRun)
      ) {
        await closeRun(db, currentRunId, {
          reason: "PRESENTATION_ADVANCED",
          keepCurrent: false,
        });
      } else {
        await deactivateRunWithoutFinalizing(db, currentRunId);
      }
    }
    return null;
  }

  let resolvedAssignment:
    | Awaited<ReturnType<typeof resolveInteractionAssignment>>
    | null = null;
  const assignment = input.knownOpenQuizSectionId === undefined
    ? await db.quiz_fragen.findFirst({
        where: {
          quiz_id: input.quizId,
          quiz_fragen_id: identity.questionAssignmentId,
        },
        select: { quiz_abschnitt_id: true, ergebnisdarstellung: true },
      })
    : (resolvedAssignment = await resolveInteractionAssignment(
        db,
        input.quizId,
        identity.questionAssignmentId,
      )).assignment;
  const blockRelease = assignment?.quiz_abschnitt_id
    ? assignment.quiz_abschnitt_id === input.knownOpenQuizSectionId
      ? { ist_freigegeben: true, ist_geschlossen: false }
      : await db.quiz_block_freigaben.findUnique({
          where: {
            quiz_id_quiz_abschnitt_id: {
              quiz_id: input.quizId,
              quiz_abschnitt_id: assignment.quiz_abschnitt_id,
            },
          },
          select: { ist_freigegeben: true, ist_geschlossen: true },
        })
    : null;
  if (!isQuizQuestionBlockOpen(blockRelease)) {
    if (currentRunId !== null) {
      const currentRun = await db.quiz_interaction_runs.findUnique({
        where: { interaction_run_id: currentRunId },
      });
      if (currentRun?.quiz_fragen_id === identity.questionAssignmentId) {
        await closeRun(db, currentRunId, {
          reason: "BLOCK_LOCKED",
          keepCurrent: false,
        });
      }
    }
    return null;
  }

  const currentRun = currentRunId === null
    ? null
    : await db.quiz_interaction_runs.findUnique({
        where: { interaction_run_id: currentRunId },
      });

  if (identity.phase === "QUESTION") {
    if (
      currentRun?.quiz_fragen_id === identity.questionAssignmentId &&
      shouldReuseQuestionInteractionRun({
        state: currentRun.state,
        liveResultsEnabled: assignment?.ergebnisdarstellung === "LIVE",
        stoppedPixelRunReusable: shouldReuseStoppedPixelRunOnQuestionReentry({
          state: currentRun.state,
          configSnapshot: currentRun.config_snapshot,
          stoppedAt: currentRun.stopped_at,
          stoppedAtStage: currentRun.stopped_at_stage,
        }),
      })
    ) {
      return currentRun;
    }
    if (currentRun) {
      if (!shouldKeepRunOpenUntilBlockClose(currentRun)) {
        await closeRun(db, currentRun.interaction_run_id, {
          reason: "PRESENTATION_ADVANCED",
          keepCurrent: false,
        });
      } else {
        await deactivateRunWithoutFinalizing(db, currentRun.interaction_run_id);
      }
    }
    const previousRun = await db.quiz_interaction_runs.findFirst({
      where: {
        quiz_id: input.quizId,
        quiz_fragen_id: identity.questionAssignmentId,
      },
      orderBy: { interaction_run_id: "desc" },
    });
    if (
      previousRun &&
      shouldReuseQuestionInteractionRun({
        state: previousRun.state,
        liveResultsEnabled: assignment?.ergebnisdarstellung === "LIVE",
        stoppedPixelRunReusable: shouldReuseStoppedPixelRunOnQuestionReentry({
          state: previousRun.state,
          configSnapshot: previousRun.config_snapshot,
          stoppedAt: previousRun.stopped_at,
          stoppedAtStage: previousRun.stopped_at_stage,
        }),
      })
    ) {
      return db.quiz_interaction_runs.update({
        where: { interaction_run_id: previousRun.interaction_run_id },
        data: { is_current: true, revision: { increment: 1 } },
      });
    }
    const resolved = previousRun
      ? null
      : resolvedAssignment ??
        (await resolveInteractionAssignment(
          db,
          input.quizId,
          identity.questionAssignmentId,
        ));
    return db.quiz_interaction_runs.create({
      data: {
        quiz_id: input.quizId,
        quiz_fragen_id: identity.questionAssignmentId,
        interaction_type:
          previousRun?.interaction_type ?? resolved!.interaction.type,
        state: "OPEN",
        is_current: true,
        opened_at: new Date(),
        revision: 1,
        config_snapshot:
          previousRun?.config_snapshot ??
          toJson(buildInteractionConfigSnapshot(resolved!)),
      },
    });
  }

  if (identity.phase === "FUNNY") {
    const funnyRun = currentRun?.quiz_fragen_id === identity.questionAssignmentId
      ? currentRun
      : await db.quiz_interaction_runs.findFirst({
          where: { quiz_id: input.quizId, quiz_fragen_id: identity.questionAssignmentId },
          orderBy: { interaction_run_id: "desc" },
        });
    if (!funnyRun) return null;
    if (funnyRun.state === "OPEN" || funnyRun.state === "COUNTDOWN") {
      return closeRun(db, funnyRun.interaction_run_id, {
        reason: "PRESENTATION_ADVANCED",
        keepCurrent: true,
      });
    }
    return funnyRun;
  }

  let revealRun = currentRun?.quiz_fragen_id === identity.questionAssignmentId
    ? currentRun
    : await db.quiz_interaction_runs.findFirst({
        where: {
          quiz_id: input.quizId,
          quiz_fragen_id: identity.questionAssignmentId,
        },
        orderBy: { interaction_run_id: "desc" },
      });
  if (currentRun && currentRun.interaction_run_id !== revealRun?.interaction_run_id) {
    if (!shouldKeepRunOpenUntilBlockClose(currentRun)) {
      await closeRun(db, currentRun.interaction_run_id, {
        reason: "PRESENTATION_ADVANCED",
        keepCurrent: false,
      });
    } else {
      await deactivateRunWithoutFinalizing(db, currentRun.interaction_run_id);
    }
  }
  if (!revealRun) {
    const resolved =
      resolvedAssignment ??
      (await resolveInteractionAssignment(
        db,
        input.quizId,
        identity.questionAssignmentId,
      ));
    return db.quiz_interaction_runs.create({
      data: {
        quiz_id: input.quizId,
        quiz_fragen_id: identity.questionAssignmentId,
        interaction_type: resolved.interaction.type,
        state: "REVEALED",
        is_current: true,
        revealed_at: new Date(),
        revision: 1,
        config_snapshot: toJson(buildInteractionConfigSnapshot(resolved)),
      },
    });
  }
  if (revealRun.state === "OPEN" || revealRun.state === "COUNTDOWN") {
    revealRun = await closeRun(db, revealRun.interaction_run_id, {
      reason: "SOLUTION_REVEALED",
      keepCurrent: true,
    });
  }
  if (revealRun?.state === "CLOSED") {
    assertQuizInteractionTransition("CLOSED", "REVEALED");
    return db.quiz_interaction_runs.update({
      where: { interaction_run_id: revealRun.interaction_run_id },
      data: {
        state: "REVEALED",
        is_current: true,
        revealed_at: new Date(),
        revision: { increment: 1 },
      },
    });
  }
  return revealRun;
}

async function syncLivePollForPresentation(
  db: DbClient,
  input: { quizId: number; placementId: number; currentRunId: number | null },
) {
  const resolved = await loadLivePollPlacement(db, input.quizId, input.placementId);
  const currentRun = input.currentRunId === null
    ? null
    : await db.quiz_interaction_runs.findUnique({ where: { interaction_run_id: input.currentRunId } });
  if (!resolved?.config) {
    if (input.currentRunId !== null) {
      await closeRun(db, input.currentRunId, { reason: "POLL_UNAVAILABLE", keepCurrent: false });
    }
    return null;
  }
  if (
    currentRun?.quiz_ablauf_element_id === input.placementId &&
    currentRun.state === "OPEN" &&
    readLivePollRunSnapshot(currentRun.config_snapshot)
  ) {
    return currentRun;
  }
  if (input.currentRunId !== null) {
    await closeRun(db, input.currentRunId, { reason: "PRESENTATION_ADVANCED", keepCurrent: false });
  }
  return db.quiz_interaction_runs.create({
    data: {
      quiz_id: input.quizId,
      quiz_ablauf_element_id: input.placementId,
      interaction_type: resolved.config.type === "SINGLE_CHOICE"
        ? "CONTENT_POLL_SINGLE"
        : "CONTENT_POLL_TEXT",
      state: "OPEN",
      is_current: true,
      opened_at: new Date(),
      config_snapshot: toJson(buildLivePollRunSnapshot(resolved.config)),
    },
  });
}

export async function closeCurrentInteraction(
  db: DbClient,
  quizId: number,
  reason = "MODERATOR_CLOSED",
) {
  const runId = await lockCurrentRun(db, quizId);
  return runId === null
    ? null
    : closeRun(db, runId, { reason, keepCurrent: true });
}

export async function closeQuizQuestionInteraction(
  db: DbClient,
  input: {
    quizId: number;
    quizFragenId: number;
    interactionRunId: number;
    reason?: string;
  },
) {
  await lockRun(db, input.interactionRunId);
  const run = await db.quiz_interaction_runs.findUnique({
    where: { interaction_run_id: input.interactionRunId },
  });
  if (
    !run ||
    !run.is_current ||
    run.quiz_id !== input.quizId ||
    run.quiz_fragen_id !== input.quizFragenId
  ) {
    return null;
  }
  return closeRun(db, input.interactionRunId, {
    reason: input.reason ?? "MODERATOR_CLOSED",
    keepCurrent: true,
    evaluateFinalizedDrafts:
      resolveInteractionClosePolicy("LIVE_RESULT").evaluateAutoFinalizedDrafts,
    reconcileAuthoritativeLiveDrafts: true,
  });
}

export async function closeBlockInteractions(
  db: DbClient,
  quizId: number,
  quizAbschnittId: number,
  reason = "MODERATOR_CLOSED_BLOCK",
) {
  const runs = await db.quiz_interaction_runs.findMany({
    where: {
      quiz_id: quizId,
      state: { in: ["OPEN", "COUNTDOWN"] },
      quiz_fragen: { quiz_abschnitt_id: quizAbschnittId },
    },
    orderBy: { interaction_run_id: "asc" },
    select: { interaction_run_id: true },
  });
  for (const run of runs) {
    await closeRun(db, run.interaction_run_id, {
      reason,
      keepCurrent: false,
    });
  }
  return runs.length;
}

export async function startInteractionCountdown(
  quizId: number,
  deadlineAt: Date,
) {
  return prisma.$transaction(async (tx) => {
    const runId = await lockCurrentRun(tx, quizId);
    if (runId === null) throw new Error("Es ist keine Interaktion ge\u00f6ffnet.");
    const run = await tx.quiz_interaction_runs.findUniqueOrThrow({
      where: { interaction_run_id: runId },
    });
    assertQuizInteractionTransition(run.state, "COUNTDOWN");
    if (deadlineAt <= new Date()) throw new Error("Die Deadline liegt in der Vergangenheit.");
    return tx.quiz_interaction_runs.update({
      where: { interaction_run_id: runId },
      data: {
        state: "COUNTDOWN",
        deadline_at: deadlineAt,
        revision: { increment: 1 },
      },
    });
  });
}

async function expireDeadlineIfNecessary(db: DbClient, runId: number, now: Date) {
  await lockRun(db, runId);
  const run = await db.quiz_interaction_runs.findUnique({
    where: { interaction_run_id: runId },
  });
  if (
    run?.state === "COUNTDOWN" &&
    run.deadline_at &&
    run.deadline_at <= now
  ) {
    return closeRun(db, runId, {
      reason: "DEADLINE_EXPIRED",
      keepCurrent: true,
    });
  }
  return run;
}

async function isRunReleasedForAnswerWrite(
  db: DbClient,
  run: {
    is_current: boolean;
    config_snapshot: Prisma.JsonValue;
    opened_at: Date | null;
  },
  assignment: {
    quiz_abschnitt_id: number | null;
  },
  quizId: number,
  requestedSectionId: number,
) {
  if (assignment.quiz_abschnitt_id === null) return run.is_current;
  const release = await db.quiz_block_freigaben.findUnique({
    where: {
      quiz_id_quiz_abschnitt_id: {
        quiz_id: quizId,
        quiz_abschnitt_id: requestedSectionId,
      },
    },
  });
  return isQuizAnswerRunReleasedForWrite({
    run: {
      isCurrent: run.is_current,
      isPixel: isPixelInteractionRun(run),
      openedAt: run.opened_at,
    },
    assignmentSectionId: assignment.quiz_abschnitt_id,
    requestedSectionId,
    release: release
      ? {
          isReleased: release.ist_freigegeben,
          isClosed: release.ist_geschlossen,
          releasedAt: release.freigegeben_ab,
        }
      : null,
  });
}

export type SaveTeamAnswerDraftResult =
  | { success: true; draftRevision: number; draftUpdatedAt: string }
  | {
      success: false;
      reason: "LIVE_STATE_CHANGED" | "REVISION_CONFLICT" | "FINALIZED";
      currentDraftRevision?: number;
    };

export async function saveTeamAnswerDraft(input: {
  quizId: number;
  quizAbschnittId: number;
  quizFragenId: number;
  interactionRunId: number;
  quizTeamSessionId: number;
  expectedDraftRevision: number;
  draft: TeamAnswerDraftInput;
}): Promise<SaveTeamAnswerDraftResult> {
  return prisma.$transaction(async (tx) => {
    const resolved = await resolveInteractionAssignment(
      tx,
      input.quizId,
      input.quizFragenId,
    );
    const authoritativeLiveRunId =
      resolved.assignment.ergebnisdarstellung === "LIVE"
        ? await lockCurrentRun(tx, input.quizId)
        : null;
    const interactionRunId =
      resolved.assignment.ergebnisdarstellung === "LIVE"
        ? authoritativeLiveRunId
        : input.interactionRunId;
    if (interactionRunId === null) {
      return { success: false, reason: "LIVE_STATE_CHANGED" };
    }
    await lockRun(tx, interactionRunId);
    let run = await tx.quiz_interaction_runs.findUnique({
      where: { interaction_run_id: interactionRunId },
    });
    const now = new Date();
    if (run) run = await expireDeadlineIfNecessary(tx, run.interaction_run_id, now);
    if (
      !run ||
      run.quiz_id !== input.quizId ||
      run.quiz_fragen_id !== input.quizFragenId ||
      !isQuizInteractionWritable(
        run.state as QuizInteractionState,
        run.deadline_at,
        now,
      )
    ) {
      return { success: false, reason: "LIVE_STATE_CHANGED" };
    }
    if (
      readPixelLiveConfigSnapshot(run.config_snapshot) &&
      run.stopped_by_team_session_id === input.quizTeamSessionId
    ) {
      return { success: false, reason: "FINALIZED" };
    }
    if (!await isRunReleasedForAnswerWrite(
      tx,
      run,
      resolved.assignment,
      input.quizId,
      input.quizAbschnittId,
    )) {
      return { success: false, reason: "LIVE_STATE_CHANGED" };
    }
    const teamSession = await tx.quiz_team_sessions.findFirst({
        where: {
          quiz_team_session_id: input.quizTeamSessionId,
          quiz_id: input.quizId,
        },
      });
    const existingSubmission = await tx.team_answer_submissions.findFirst({
      where: {
        interaction_run_id: run.interaction_run_id,
        quiz_team_session_id: input.quizTeamSessionId,
      },
      orderBy: { submission_version: "desc" },
    });
    if (!teamSession || resolved.assignment.quiz_abschnitt_id !== input.quizAbschnittId) {
      throw new Error("Teamantwort ist f\u00fcr diese Quizfrage nicht autorisiert.");
    }
    const submissionPolicy = resolveInteractionSubmissionPolicy(
      run.interaction_type,
    );
    if (
      existingSubmission &&
      !submissionPolicy.resubmissionAllowedWhileOpen
    ) {
      return { success: false, reason: "FINALIZED" };
    }
    const validated = validateInteractionPayload(resolved.interaction, input.draft);

    await tx.$queryRaw`
      SELECT "team_antwort_id"
      FROM "pubquiz"."team_antworten"
      WHERE "quiz_fragen_id" = ${input.quizFragenId}
        AND "quiz_team_session_id" = ${input.quizTeamSessionId}
      FOR UPDATE
    `;
    const previous = await tx.team_antworten.findUnique({
      where: {
        quiz_fragen_id_quiz_team_session_id: {
          quiz_fragen_id: input.quizFragenId,
          quiz_team_session_id: input.quizTeamSessionId,
        },
      },
      include: { antwortauswahlen: true, antwortfelder: true },
    });
    const previousBelongsToLiveResponsePhase = Boolean(
      previous &&
        resolved.assignment.ergebnisdarstellung === "LIVE" &&
        isDraftEligibleForAuthoritativeLiveRun({
          draftInteractionRunId: previous.interaction_run_id,
          draftUpdatedAt:
            previous.draft_updated_at ?? previous.aktualisiert_am,
          authoritativeRunId: run.interaction_run_id,
          authoritativeRunOpenedAt: run.opened_at,
        }),
    );
    const currentRevision =
      previous?.interaction_run_id === run.interaction_run_id ||
      previousBelongsToLiveResponsePhase
        ? previous?.draft_revision ?? 0
        : 0;
    const contentChanged =
      previous?.interaction_run_id !== run.interaction_run_id ||
      !previous ||
      hasAnswerContentChanged(
        draftInputFromStored(previous),
        input.draft,
      );
    if (input.expectedDraftRevision !== currentRevision) {
      if (!contentChanged && previous) {
        return {
          success: true,
          draftRevision: previous.draft_revision,
          draftUpdatedAt: (
            previous.draft_updated_at ?? previous.aktualisiert_am
          ).toISOString(),
        };
      }
      return {
        success: false,
        reason: "REVISION_CONFLICT",
        currentDraftRevision: currentRevision,
      };
    }
    const requestedAnswerIds = [...input.draft.selectedAnswerIds];
    if (!contentChanged && previous) {
      return {
        success: true,
        draftRevision: previous.draft_revision,
        draftUpdatedAt: (previous.draft_updated_at ?? previous.aktualisiert_am).toISOString(),
      };
    }
    const nextRevision = currentRevision + 1;
    const answer = await tx.team_antworten.upsert({
      where: {
        quiz_fragen_id_quiz_team_session_id: {
          quiz_fragen_id: input.quizFragenId,
          quiz_team_session_id: input.quizTeamSessionId,
        },
      },
      update: {
        quiz_id: input.quizId,
        quiz_abschnitt_id: input.quizAbschnittId,
        interaction_run_id: run.interaction_run_id,
        antwort_text: input.draft.answerText,
        antwort_id: requestedAnswerIds[0] ?? null,
        aktualisiert_am: now,
        draft_updated_at: now,
        draft_revision: nextRevision,
      },
      create: {
        quiz_id: input.quizId,
        quiz_abschnitt_id: input.quizAbschnittId,
        quiz_fragen_id: input.quizFragenId,
        quiz_team_session_id: input.quizTeamSessionId,
        interaction_run_id: run.interaction_run_id,
        antwort_text: input.draft.answerText,
        antwort_id: requestedAnswerIds[0] ?? null,
        aktualisiert_am: now,
        draft_updated_at: now,
        draft_revision: nextRevision,
        bewertungsquelle: "AUTO",
      },
    });
    await tx.team_antwort_auswahlen.deleteMany({
      where: { team_antwort_id: answer.team_antwort_id },
    });
    if (requestedAnswerIds.length > 0) {
      await tx.team_antwort_auswahlen.createMany({
        data: requestedAnswerIds.map((answerId) => ({
          team_antwort_id: answer.team_antwort_id,
          antwort_id: answerId,
        })),
      });
    }
    await tx.team_antwortfelder.deleteMany({
      where: { team_antwort_id: answer.team_antwort_id },
    });
    const nonEmptyFields = input.draft.structuredAnswers.filter((field) =>
      field.answerText?.trim(),
    );
    if (nonEmptyFields.length > 0) {
      await tx.team_antwortfelder.createMany({
        data: nonEmptyFields.map((field) => ({
          team_antwort_id: answer.team_antwort_id,
          antwortfeld_id: field.fieldId,
          antwort_text: field.answerText?.trim() ?? null,
        })),
      });
    }
    void validated;
    return {
      success: true,
      draftRevision: nextRevision,
      draftUpdatedAt: now.toISOString(),
    };
  });
}

export async function submitTeamAnswer(input: {
  quizId: number;
  quizFragenId: number;
  interactionRunId: number;
  quizTeamSessionId: number;
}) {
  return prisma.$transaction(async (tx) => {
    await lockRun(tx, input.interactionRunId);
    let run = await tx.quiz_interaction_runs.findUnique({
      where: { interaction_run_id: input.interactionRunId },
    });
    const now = new Date();
    if (run) run = await expireDeadlineIfNecessary(tx, run.interaction_run_id, now);
    if (
      !run ||
      !run.is_current ||
      run.quiz_id !== input.quizId ||
      run.quiz_fragen_id !== input.quizFragenId ||
      !isQuizInteractionWritable(run.state as QuizInteractionState, run.deadline_at, now)
    ) {
      return { success: false, reason: "LIVE_STATE_CHANGED" as const };
    }
    if (
      readPixelLiveConfigSnapshot(run.config_snapshot) &&
      run.stopped_by_team_session_id === input.quizTeamSessionId
    ) {
      return { success: false, reason: "FINALIZED" as const };
    }
    const draft = await tx.team_antworten.findUnique({
      where: {
        quiz_fragen_id_quiz_team_session_id: {
          quiz_fragen_id: input.quizFragenId,
          quiz_team_session_id: input.quizTeamSessionId,
        },
      },
      include: { antwortauswahlen: true, antwortfelder: true },
    });
    if (!draft || draft.interaction_run_id !== run.interaction_run_id) {
      return { success: false, reason: "NO_DRAFT" as const };
    }
    const interaction = readInteractionSnapshot(run.config_snapshot);
    const validated = validateInteractionPayload(interaction, draftInputFromStored(draft));
    if (!validated.hasContent) {
      return { success: false, reason: "EMPTY_DRAFT" as const };
    }
    const existingSubmissions = await tx.team_answer_submissions.findMany({
      where: {
        interaction_run_id: run.interaction_run_id,
        quiz_team_session_id: input.quizTeamSessionId,
      },
      orderBy: { submission_version: "asc" },
      select: {
        team_answer_submission_id: true,
        submission_version: true,
        draft_revision: true,
        status: true,
      },
    });
    const versionPlan = planSubmissionVersion(
      existingSubmissions.map((submission) => ({
        submissionVersion: submission.submission_version,
        draftRevision: submission.draft_revision,
      })),
      draft.draft_revision,
    );
    if (versionPlan.kind === "IDEMPOTENT") {
      const existing = existingSubmissions.find(
        (submission) =>
          submission.draft_revision === draft.draft_revision,
      )!;
      if (!isPollInteractionType(run.interaction_type)) {
        await recalculateQuizAnswerEvaluation(draft.team_antwort_id, tx);
      }
      return {
        success: true,
        status: existing.status,
        idempotent: true,
        submissionVersion: existing.submission_version,
        draftRevision: existing.draft_revision,
      };
    }
    const submission = await tx.team_answer_submissions.create({
      data: {
        interaction_run_id: run.interaction_run_id,
        team_antwort_id: draft.team_antwort_id,
        quiz_team_session_id: input.quizTeamSessionId,
        submission_version: versionPlan.submissionVersion,
        status: "SUBMITTED",
        interaction_type: run.interaction_type,
        payload: toJson(validated.payload),
        draft_revision: draft.draft_revision,
        finalization_reason: "TEAM_SUBMITTED",
      },
    });
    if (!isPollInteractionType(run.interaction_type)) {
      await recalculateQuizAnswerEvaluation(draft.team_antwort_id, tx);
    }
    return {
      success: true,
      status: submission.status,
      idempotent: false,
      submissionVersion: submission.submission_version,
      draftRevision: submission.draft_revision,
    };
  });
}

export type StopPixelQuestionResult =
  | {
      success: true;
      stage: 1 | 2;
      deadlineAt: string;
      submissionVersion: number;
    }
  | {
      success: false;
      reason:
        | "LIVE_STATE_CHANGED"
        | "ALREADY_STOPPED"
        | "STOP_NOT_AVAILABLE"
        | "NO_DRAFT"
        | "EMPTY_DRAFT";
    };

export async function stopPixelQuestion(input: {
  quizId: number;
  quizFragenId: number;
  interactionRunId: number;
  quizTeamSessionId: number;
}): Promise<StopPixelQuestionResult> {
  return prisma.$transaction(async (tx) => {
    await lockRun(tx, input.interactionRunId);
    let run = await tx.quiz_interaction_runs.findUnique({
      where: { interaction_run_id: input.interactionRunId },
    });
    const now = new Date();
    if (run) run = await expireDeadlineIfNecessary(tx, run.interaction_run_id, now);
    if (
      !run ||
      !run.is_current ||
      run.quiz_id !== input.quizId ||
      run.quiz_fragen_id !== input.quizFragenId
    ) {
      return { success: false, reason: "LIVE_STATE_CHANGED" };
    }
    const config = readPixelLiveConfigSnapshot(run.config_snapshot);
    if (!config) return { success: false, reason: "STOP_NOT_AVAILABLE" };
    if (run.stopped_by_team_session_id !== null) {
      return { success: false, reason: "ALREADY_STOPPED" };
    }
    const stage = resolveEffectivePixelStage({
      openedAt: run.opened_at,
      serverNow: now,
      config,
    });
    if (run.state !== "OPEN" || stage === 3) {
      return { success: false, reason: "STOP_NOT_AVAILABLE" };
    }
    const teamSession = await tx.quiz_team_sessions.findFirst({
      where: {
        quiz_team_session_id: input.quizTeamSessionId,
        quiz_id: input.quizId,
      },
    });
    if (!teamSession) return { success: false, reason: "LIVE_STATE_CHANGED" };
    const draft = await tx.team_antworten.findUnique({
      where: {
        quiz_fragen_id_quiz_team_session_id: {
          quiz_fragen_id: input.quizFragenId,
          quiz_team_session_id: input.quizTeamSessionId,
        },
      },
      include: { antwortauswahlen: true, antwortfelder: true },
    });
    if (!draft || draft.interaction_run_id !== run.interaction_run_id) {
      return { success: false, reason: "NO_DRAFT" };
    }
    const validated = validateInteractionPayload(
      readInteractionSnapshot(run.config_snapshot),
      draftInputFromStored(draft),
    );
    if (!validated.hasContent) return { success: false, reason: "EMPTY_DRAFT" };

    const deadlineAt = new Date(
      now.getTime() + config.stopCountdownSeconds * 1_000,
    );
    const claimed = await tx.quiz_interaction_runs.updateMany({
      where: {
        interaction_run_id: run.interaction_run_id,
        state: "OPEN",
        stopped_by_team_session_id: null,
      },
      data: {
        state: "COUNTDOWN",
        deadline_at: deadlineAt,
        stopped_by_team_session_id: input.quizTeamSessionId,
        stopped_at: now,
        stopped_at_stage: stage,
        revision: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      return { success: false, reason: "ALREADY_STOPPED" };
    }
    const existingSubmissions = await tx.team_answer_submissions.findMany({
      where: {
        interaction_run_id: run.interaction_run_id,
        quiz_team_session_id: input.quizTeamSessionId,
      },
      select: { submission_version: true, draft_revision: true },
    });
    const versionPlan = planSubmissionVersion(
      existingSubmissions.map((submission) => ({
        submissionVersion: submission.submission_version,
        draftRevision: submission.draft_revision,
      })),
      draft.draft_revision,
    );
    const submissionVersion = versionPlan.kind === "IDEMPOTENT"
      ? versionPlan.submission.submissionVersion
      : versionPlan.submissionVersion;
    if (versionPlan.kind === "CREATE") {
      await tx.team_answer_submissions.create({
        data: {
          interaction_run_id: run.interaction_run_id,
          team_antwort_id: draft.team_antwort_id,
          quiz_team_session_id: input.quizTeamSessionId,
          submission_version: submissionVersion,
          status: "SUBMITTED",
          interaction_type: run.interaction_type,
          payload: toJson(validated.payload),
          draft_revision: draft.draft_revision,
          finalization_reason: "PIXEL_STOPPED",
        },
      });
    }
    await recalculateQuizQuestionEvaluation(input.quizFragenId, tx);
    return {
      success: true,
      stage,
      deadlineAt: deadlineAt.toISOString(),
      submissionVersion,
    };
  }, { timeout: 30_000 });
}

export async function getQuizLiveSnapshotData(
  quizId: number,
  quizTeamSessionId: number | null,
  options: {
    includePresentationState?: boolean;
    includeTeamJoinState?: boolean;
    includeLiveModeration?: boolean;
    presentationQuestionAssignmentId?: number;
  } = {},
) {
  const serverNow = new Date();
  const runQuery = () => prisma.quiz_interaction_runs.findFirst({
      where: {
        quiz_id: quizId,
        ...(options.presentationQuestionAssignmentId === undefined
          ? { is_current: true }
          : { quiz_fragen_id: options.presentationQuestionAssignmentId }),
      },
      orderBy: { interaction_run_id: "desc" },
      include: {
        stopped_by_team_session: { select: { teamname: true } },
        quiz_fragen: {
          select: {
            quiz_fragen_id: true,
            fragen_id: true,
            quiz_abschnitt_id: true,
            ergebnisdarstellung: true,
          },
        },
      },
    });
  const [initialRun, blockRelease] = await Promise.all([
    runQuery(),
    prisma.quiz_block_freigaben.findFirst({
      where: { quiz_id: quizId },
      orderBy: [
        { freigegeben_ab: "desc" },
        { quiz_block_freigabe_id: "desc" },
      ],
    }),
  ]);
  let run = initialRun;
  if (
    run?.state === "COUNTDOWN" &&
    run.deadline_at &&
    run.deadline_at <= serverNow
  ) {
    await prisma.$transaction((tx) =>
      expireDeadlineIfNecessary(tx, run!.interaction_run_id, serverNow),
    );
    run = await runQuery();
  }
  const contentPollConfig = run ? readLivePollRunSnapshot(run.config_snapshot) : null;
  const interaction = run && !contentPollConfig ? readInteractionSnapshot(run.config_snapshot) : null;
  const pollInteraction = interaction && isPollInteractionType(interaction.type)
    ? interaction as PollInteraction
    : null;
  const liveChoiceInteraction = interaction &&
      run?.quiz_fragen?.ergebnisdarstellung === "LIVE" &&
      isLiveChoiceInteraction(interaction)
    ? interaction
    : null;
  const liveTextInteraction = interaction?.type === "TEXT" &&
      run?.quiz_fragen?.ergebnisdarstellung === "LIVE";
  const needsTeamCount = Boolean(
    options.includeTeamJoinState ||
    (options.includePresentationState && (pollInteraction || liveChoiceInteraction || liveTextInteraction)),
  );
  const [teamCount, visibleTeams, liveAnswers, replacementRules] = options.includePresentationState
    ? await Promise.all([
        needsTeamCount
          ? prisma.quiz_team_sessions.count({ where: { quiz_id: quizId } })
          : Promise.resolve(0),
        options.includeTeamJoinState
          ? prisma.quiz_team_sessions.findMany({
              where: { quiz_id: quizId },
              orderBy: [
                { erstellt_am: "asc" },
                { quiz_team_session_id: "asc" },
              ],
              take: 12,
              select: {
                teamname: true,
                team: {
                  select: {
                    team_id: true,
                    avatar_code: true,
                    foto_url: true,
                    foto_upload_gesperrt: true,
                  },
                },
              },
            })
          : Promise.resolve([]),
        pollInteraction || liveChoiceInteraction || liveTextInteraction
          ? prisma.team_antworten.findMany({
              where: {
                interaction_run_id: run!.interaction_run_id,
                quiz_fragen_id: run!.quiz_fragen!.quiz_fragen_id,
              },
              orderBy: { quiz_team_session_id: "asc" },
              select: {
                interaction_run_id: true,
                quiz_team_session_id: true,
                submissions: {
                  orderBy: [
                    { submission_version: "desc" },
                    { team_answer_submission_id: "desc" },
                  ],
                  select: {
                    team_answer_submission_id: true,
                    interaction_run_id: true,
                    submission_version: true,
                    payload: true,
                    live_text_publication: { select: { is_visible: true } },
                    quiz_team_session: {
                      select: {
                        team_id: true,
                        teamname: true,
                        team: { select: { team_id: true, avatar_code: true, foto_url: true, foto_upload_gesperrt: true } },
                      },
                    },
                  },
                },
              },
            })
          : Promise.resolve([]),
        liveTextInteraction
          ? prisma.public_text_replacement_rules.findMany({
              where: { is_active: true },
              orderBy: { public_text_replacement_rule_id: "asc" },
            })
          : Promise.resolve([]),
      ])
    : [0, [], [], []];
  const latestLiveSubmissions = run
    ? selectEffectiveLiveSubmissions({
        interactionRunId: run.interaction_run_id,
        answers: liveAnswers,
      })
    : [];
  const latestLivePayloads = latestLiveSubmissions.map(
    (submission) => submission.payload as QuizInteractionPayload,
  );
  const liveResultVisibleToAudience = run
    ? isLiveResultVisibleToAudience(run.state, run.live_results_visible)
    : false;
  const includeLiveResultAggregates = run
    ? canIncludeLiveResultAggregates({
        state: run.state,
        requestedVisibility: run.live_results_visible,
        includeModeration: options.includeLiveModeration === true,
      })
    : false;
  const exposedLiveSubmissions = includeLiveResultAggregates
    ? latestLiveSubmissions
    : [];
  const exposedLivePayloads = includeLiveResultAggregates
    ? latestLivePayloads
    : [];
  const answer = run && quizTeamSessionId
    ? await prisma.team_antworten.findFirst({
        where: {
          interaction_run_id: run.interaction_run_id,
          quiz_team_session_id: quizTeamSessionId,
        },
        include: {
          antwortauswahlen: true,
          antwortfelder: true,
          submissions: {
            where: { interaction_run_id: run.interaction_run_id },
            orderBy: [
              { submission_version: "desc" },
              { team_answer_submission_id: "desc" },
            ],
            take: 1,
          },
        },
      })
    : null;
  const [livePollState, teamLivePollResponse] = run && contentPollConfig
    ? await Promise.all([
        getLivePollStateForRun(run, options.includeLiveModeration === true),
        quizTeamSessionId
          ? prisma.live_poll_responses.findUnique({
              where: { interaction_run_id_quiz_team_session_id: { interaction_run_id: run.interaction_run_id, quiz_team_session_id: quizTeamSessionId } },
              select: { selected_option_id: true, original_text: true, updated_at: true },
            })
          : Promise.resolve(null),
      ])
    : [null, null];
  let draftPayload: QuizInteractionPayload | null = null;
  if (run && answer) {
    draftPayload = validateInteractionPayload(
      readInteractionSnapshot(run.config_snapshot),
      draftInputFromStored(answer),
    ).payload;
  }
  const submission = answer?.submissions[0] ?? null;
  const pixelConfig = run
    ? readPixelLiveConfigSnapshot(run.config_snapshot)
    : null;
  const pixelStage = run && pixelConfig
    ? resolveEffectivePixelStage({
        openedAt: run.opened_at,
        serverNow,
        config: pixelConfig,
        stoppedAtStage: run.stopped_at_stage,
      })
    : null;
  const isStopper = Boolean(
    run &&
    quizTeamSessionId &&
    run.stopped_by_team_session_id === quizTeamSessionId,
  );
  const hasDraftContent = Boolean(
    run &&
    answer &&
    validateInteractionPayload(
      readInteractionSnapshot(run.config_snapshot),
      draftInputFromStored(answer),
    ).hasContent,
  );
  const pixelTeamWriteAccess = run
    ? resolvePixelTeamWriteAccess({
        state: run.state,
        deadlineAt: run.deadline_at,
        serverNow,
        isStopper,
      })
    : { canEdit: false, canSubmit: false };
  const pixelResolution = run && pixelConfig && run.state === "REVEALED" &&
    run.stopped_by_team_session_id !== null
    ? await prisma.team_antworten.findFirst({
        where: {
          interaction_run_id: run.interaction_run_id,
          quiz_team_session_id: run.stopped_by_team_session_id,
        },
        select: {
          bewertungsstatus: true,
          vergebene_punkte: true,
          bewertungsdetails: true,
          submissions: {
            where: { interaction_run_id: run.interaction_run_id },
            orderBy: [
              { submission_version: "desc" },
              { team_answer_submission_id: "desc" },
            ],
            take: 1,
            select: { payload: true },
          },
        },
      })
    : null;
  const resolutionPayload = pixelResolution?.submissions[0]?.payload;
  const resolutionAnswer = resolutionPayload &&
    typeof resolutionPayload === "object" &&
    !Array.isArray(resolutionPayload) &&
    "text" in resolutionPayload &&
    typeof resolutionPayload.text === "string"
    ? resolutionPayload.text
    : null;
  const resolutionDetails = pixelResolution?.bewertungsdetails;
  const resolutionPixelDetails = resolutionDetails &&
    typeof resolutionDetails === "object" &&
    !Array.isArray(resolutionDetails) &&
    "pixel" in resolutionDetails &&
    resolutionDetails.pixel &&
    typeof resolutionDetails.pixel === "object" &&
    !Array.isArray(resolutionDetails.pixel)
    ? resolutionDetails.pixel as { outcome?: unknown }
    : null;
  return {
    serverNow: serverNow.toISOString(),
    liveRevision: serializeQuizParticipantLiveRevision(blockRelease, run),
    blockState: blockRelease
      ? {
          quizAbschnittId: blockRelease.quiz_abschnitt_id,
          isReleased: blockRelease.ist_freigegeben,
          isClosed: blockRelease.ist_geschlossen,
        }
      : null,
    revision: run ? `${run.interaction_run_id}:${run.revision}` : "0:0",
    interactionRun: run
      ? {
          id: run.interaction_run_id,
          type: run.interaction_type,
          state: run.state,
          deadlineAt: run.deadline_at?.toISOString() ?? null,
          revision: run.revision,
        }
      : null,
    activeQuestionReference: run?.quiz_fragen
      ? {
          quizFragenId: run.quiz_fragen.quiz_fragen_id,
          fragenId: run.quiz_fragen.fragen_id,
          quizAbschnittId: run.quiz_fragen.quiz_abschnitt_id,
        }
      : null,
    publicState: run?.state ?? "LOCKED",
    teamJoinState: options.includeTeamJoinState
      ? {
          teams: visibleTeams.map((team) => ({
            teamId: team.team.team_id,
            teamName: team.teamname,
            avatarCode: mapTeamProfile(team.team).avatarCode,
            photoUrl: team.team.foto_url,
          })),
          totalTeams: teamCount,
          remainingTeams: Math.max(0, teamCount - visibleTeams.length),
        }
      : null,
    pollState:
      pollInteraction && isPollInteractionType(pollInteraction.type)
        ? aggregatePollSubmissions({
            interaction: pollInteraction,
            state: run!.state,
            totalTeams: teamCount,
            payloads: exposedLivePayloads,
          })
        : null,
    livePollState: livePollState?.audience ?? null,
    livePollModeration: options.includeLiveModeration ? livePollState?.moderationResponses ?? [] : null,
    liveResultState:
      run && liveChoiceInteraction
        ? aggregateLiveChoiceResults({
            interaction: liveChoiceInteraction,
            visible: liveResultVisibleToAudience,
            state: run.state,
            totalTeams: teamCount,
            payloads: exposedLivePayloads,
          })
        : run && liveTextInteraction
          ? aggregateLiveTextResults({
              visible: liveResultVisibleToAudience,
              state: run.state,
              totalTeams: teamCount,
              rules: replacementRules.map((rule) => ({
                id: rule.public_text_replacement_rule_id,
                searchTerm: rule.search_term,
                replacement: rule.replacement,
              })),
              includeModeration: options.includeLiveModeration === true,
              submissions: exposedLiveSubmissions.flatMap((submission) => {
                const payload = submission.payload as QuizInteractionPayload;
                if (!("text" in payload) || !payload.text.trim()) return [];
                return [{
                  submissionId: submission.team_answer_submission_id,
                  teamId: submission.quiz_team_session.team_id,
                  teamName: submission.quiz_team_session.teamname,
                  avatarCode: mapTeamProfile(submission.quiz_team_session.team).avatarCode,
                  photoUrl: submission.quiz_team_session.team.foto_url,
                  originalText: payload.text,
                  isVisible: submission.live_text_publication?.is_visible === true,
                }];
              }),
            })
          : null,
    pixelState: run && pixelConfig && pixelStage
      ? {
          interactionType: pixelConfig.type,
          state: run.state,
          effectivePixelStage: pixelStage,
          stopped: run.stopped_by_team_session_id !== null,
          stoppedByTeamName: run.stopped_by_team_session?.teamname ?? null,
          stoppedAt: run.stopped_at?.toISOString() ?? null,
          stoppedAtStage:
            run.stopped_at_stage === 1 || run.stopped_at_stage === 2
              ? run.stopped_at_stage as 1 | 2
              : null,
          submissionDeadlineAt: run.deadline_at?.toISOString() ?? null,
          resolution: pixelResolution
            ? {
                answer: resolutionAnswer,
                status: pixelResolution.bewertungsstatus,
                points: pixelResolution.vergebene_punkte.toString(),
                outcome: ["NORMAL", "EXCLUSIVE_BONUS", "WRONG_STOP", "PENDING"].includes(
                  String(resolutionPixelDetails?.outcome),
                )
                  ? resolutionPixelDetails!.outcome as "NORMAL" | "EXCLUSIVE_BONUS" | "WRONG_STOP" | "PENDING"
                  : null,
              }
            : null,
        }
      : null,
    teamSpecificState: quizTeamSessionId
      ? {
          isStopper,
          canStop: Boolean(
            run &&
            pixelStage &&
            pixelConfig &&
            canStopPixelQuestion({
              state: run.state,
              stage: pixelStage,
              stopped: run.stopped_by_team_session_id !== null,
              hasDraftContent,
              isStopper,
            }),
          ),
          canEdit: pixelTeamWriteAccess.canEdit,
          canSubmit: pixelTeamWriteAccess.canSubmit,
          answerStatus: submission?.status ?? (answer ? "DRAFT" : null),
          draft: answer && draftPayload
            ? {
                payload: draftPayload,
                revision: answer.draft_revision,
                updatedAt: (answer.draft_updated_at ?? answer.aktualisiert_am).toISOString(),
              }
            : null,
          submission: submission
            ? {
                status: submission.status,
                submittedAt: submission.submitted_at.toISOString(),
                draftRevision: submission.draft_revision,
                submissionVersion: submission.submission_version,
              }
            : null,
          livePollResponse: teamLivePollResponse
            ? {
                selectedOptionId: teamLivePollResponse.selected_option_id,
                text: teamLivePollResponse.original_text,
                updatedAt: teamLivePollResponse.updated_at.toISOString(),
              }
            : null,
        }
      : null,
  };
}
