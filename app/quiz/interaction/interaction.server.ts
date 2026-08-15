import { Prisma } from "@/app/generated/prisma/client";
import type { ResolvedQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import { resolveQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import { hasAnswerContentChanged } from "@/app/quiz/evaluation/answerContent";
import {
  recalculateQuizAnswerEvaluation,
  recalculateQuizQuestionEvaluation,
} from "@/app/quiz/evaluation/evaluation.server";
import { resolveQuizQuestionAnswerMode } from "@/app/quiz/quizQuestionAnswerMode";
import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import { prisma } from "@/app/lib/prisma";
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
  planSubmissionVersion,
  resolveInteractionSubmissionPolicy,
  shouldAutoFinalizeDraft,
} from "./interactionSubmissionPolicy";
import {
  canStopPixelQuestion,
  createPixelLiveConfigSnapshot,
  readPixelLiveConfigSnapshot,
  resolveEffectivePixelStage,
} from "./pixelLiveInteraction";

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
  const interaction = resolveQuizAnswerInteraction({
    templateId: assignment.fragen.vorlage?.code ?? null,
    originalAnswerMode: answerMode.originalMode,
    effectiveAnswerMode: answerMode.effectiveMode,
    templateData: templateConfig?.templateData,
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
  },
  reason: string,
) {
  const interaction = readInteractionSnapshot(run.config_snapshot);
  const drafts = await db.team_antworten.findMany({
      where: { interaction_run_id: run.interaction_run_id },
      include: { antwortauswahlen: true, antwortfelder: true },
    });
  const existing = await db.team_answer_submissions.findMany({
      where: { interaction_run_id: run.interaction_run_id },
      select: {
        quiz_team_session_id: true,
        submission_version: true,
        draft_revision: true,
      },
    });
  const finalizedTeams = new Set(existing.map((item) => item.quiz_team_session_id));
  const pixelConfig = readPixelLiveConfigSnapshot(run.config_snapshot);
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
      hasExplicitSubmission: pixelConfig
        ? teamSubmissions.some(
            (submission) => submission.draft_revision === draft.draft_revision,
          )
        : finalizedTeams.has(draft.quiz_team_session_id),
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

async function closeRun(
  db: DbClient,
  runId: number,
  options: { reason: string; keepCurrent: boolean },
) {
  await lockRun(db, runId);
  const run = await db.quiz_interaction_runs.findUnique({
    where: { interaction_run_id: runId },
  });
  if (!run) return null;
  if (run.state === "OPEN" || run.state === "COUNTDOWN") {
    await autoFinalizeDrafts(db, run, options.reason);
    if (run.quiz_fragen_id !== null) {
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
  input: { quizId: number; slideKey: string },
) {
  const currentRunId = await lockCurrentRun(db, input.quizId);
  const identity = parsePresentationSlideKey(input.slideKey);
  if (identity?.kind !== "QUESTION") {
    if (currentRunId !== null) {
      await closeRun(db, currentRunId, {
        reason: "PRESENTATION_ADVANCED",
        keepCurrent: false,
      });
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
      currentRun?.quiz_fragen_id === identity.questionAssignmentId
    ) {
      return currentRun;
    }
    if (currentRun) {
      await closeRun(db, currentRun.interaction_run_id, {
        reason: "PRESENTATION_ADVANCED",
        keepCurrent: false,
      });
    }
    const resolved = await resolveInteractionAssignment(
      db,
      input.quizId,
      identity.questionAssignmentId,
    );
    return db.quiz_interaction_runs.create({
      data: {
        quiz_id: input.quizId,
        quiz_fragen_id: identity.questionAssignmentId,
        interaction_type: resolved.interaction.type,
        state: "OPEN",
        is_current: true,
        opened_at: new Date(),
        revision: 1,
        config_snapshot: toJson(buildInteractionConfigSnapshot(resolved)),
      },
    });
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
    await closeRun(db, currentRun.interaction_run_id, {
      reason: "PRESENTATION_ADVANCED",
      keepCurrent: false,
    });
  }
  if (!revealRun) {
    const resolved = await resolveInteractionAssignment(
      db,
      input.quizId,
      identity.questionAssignmentId,
    );
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
    const teamSession = await tx.quiz_team_sessions.findFirst({
        where: {
          quiz_team_session_id: input.quizTeamSessionId,
          quiz_id: input.quizId,
        },
      });
    const resolved = await resolveInteractionAssignment(
      tx,
      input.quizId,
      input.quizFragenId,
    );
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
    const currentRevision =
      previous?.interaction_run_id === run.interaction_run_id
        ? previous.draft_revision
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
      await recalculateQuizAnswerEvaluation(draft.team_antwort_id, tx);
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
    await recalculateQuizAnswerEvaluation(draft.team_antwort_id, tx);
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
) {
  const serverNow = new Date();
  const current = await prisma.quiz_interaction_runs.findFirst({
    where: { quiz_id: quizId, is_current: true },
    select: { interaction_run_id: true },
  });
  if (current) {
    await prisma.$transaction((tx) =>
      expireDeadlineIfNecessary(tx, current.interaction_run_id, serverNow),
    );
  }
  const run = await prisma.quiz_interaction_runs.findFirst({
    where: { quiz_id: quizId, is_current: true },
    include: {
      stopped_by_team_session: { select: { teamname: true } },
      quiz_fragen: {
        select: { quiz_fragen_id: true, fragen_id: true, quiz_abschnitt_id: true },
      },
    },
  });
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
  const writable = Boolean(
    run &&
    isQuizInteractionWritable(run.state, run.deadline_at, serverNow),
  );
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
          canEdit: writable && !isStopper,
          canSubmit: writable && !isStopper,
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
        }
      : null,
  };
}
