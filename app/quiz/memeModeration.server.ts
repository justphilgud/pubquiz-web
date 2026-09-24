import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  collectValidMemeSubmissions,
  createMemeSelectionPlan,
  validateMemeReviewCompletion,
  type MemeReviewStatus,
  type StoredMemeSubmission,
} from "@/app/quiz/memeModeration";
import { memeCaptionPayloadValues, parseMemeCaptionPayload, readMemeLiveConfigSnapshot } from "@/app/quiz/memeCaption";
import { resolveMemeCaptionLayout, type ResolvedMemeCaptionLayout } from "@/app/quiz/memeCaptionZones";
import { readInteractionSnapshot } from "@/app/quiz/interaction/interactionStoredAnswer";

type DbClient = Prisma.TransactionClient;

export type MemeModerationCandidateView = {
  candidateId: number;
  submissionId: number;
  position: number;
  reviewStatus: MemeReviewStatus;
  reviewRevision: number;
  captions: Record<string, string>;
  layout: ResolvedMemeCaptionLayout;
};

export type MemeModerationView =
  | {
      phase: "NOT_READY";
      interactionState: "LOCKED" | "OPEN" | "COUNTDOWN";
    }
  | {
      phase: "REVIEW";
      selectionId: number;
      interactionRunId: number;
      selectionState: "REVIEWING" | "COMPLETED" | "SKIPPED";
      revision: number;
      validSubmissionCount: number;
      selectionLimit: number | null;
      selectedCount: number;
      approvedCount: number;
      rejectedCount: number;
      pendingCount: number;
      candidates: MemeModerationCandidateView[];
    }
  | { phase: "UNAVAILABLE" };

type StoredSelection = Prisma.meme_moderation_selectionsGetPayload<{
  include: {
    candidates: {
      include: { submission: true };
    };
    interaction_run: { select: { config_snapshot: true } };
  };
}>;

function toView(selection: StoredSelection): MemeModerationView {
  const interaction = readInteractionSnapshot(selection.interaction_run.config_snapshot);
  const layout = interaction.type === "MEME_CAPTION"
    ? resolveMemeCaptionLayout(interaction.layout)
    : resolveMemeCaptionLayout(null);
  const candidates = selection.candidates
    .map((candidate) => {
      const payload = parseMemeCaptionPayload(candidate.submission.payload);
      if (!payload) {
        throw new Error("Ein gespeicherter Meme-Kandidat ist ungültig.");
      }
      return {
        candidateId: candidate.meme_moderation_candidate_id,
        submissionId: candidate.team_answer_submission_id,
        position: candidate.position,
        reviewStatus: candidate.review_status,
        reviewRevision: candidate.review_revision,
        captions: memeCaptionPayloadValues(payload).captions,
        layout,
      };
    })
    .sort((left, right) => left.position - right.position);

  return {
    phase: "REVIEW",
    selectionId: selection.meme_moderation_selection_id,
    interactionRunId: selection.interaction_run_id,
    selectionState: selection.state,
    revision: selection.revision,
    validSubmissionCount: selection.valid_submission_count,
    selectionLimit: selection.selection_limit,
    selectedCount: candidates.length,
    approvedCount: candidates.filter((item) => item.reviewStatus === "APPROVED").length,
    rejectedCount: candidates.filter((item) => item.reviewStatus === "REJECTED").length,
    pendingCount: candidates.filter((item) => item.reviewStatus === "PENDING_REVIEW").length,
    candidates,
  };
}

const selectionInclude = {
  interaction_run: { select: { config_snapshot: true } },
  candidates: {
    include: { submission: true },
    orderBy: { position: "asc" as const },
  },
};

async function readSelection(db: DbClient, selectionId: number) {
  return db.meme_moderation_selections.findUniqueOrThrow({
    where: { meme_moderation_selection_id: selectionId },
    include: selectionInclude,
  });
}

async function lockRun(db: DbClient, interactionRunId: number) {
  await db.$queryRaw`
    SELECT "interaction_run_id"
    FROM "pubquiz"."quiz_interaction_runs"
    WHERE "interaction_run_id" = ${interactionRunId}
    FOR UPDATE
  `;
}

async function lockSelection(db: DbClient, selectionId: number) {
  await db.$queryRaw`
    SELECT "meme_moderation_selection_id"
    FROM "pubquiz"."meme_moderation_selections"
    WHERE "meme_moderation_selection_id" = ${selectionId}
    FOR UPDATE
  `;
}

export async function getOrCreateMemeModerationView(input: {
  quizId: number;
  quizFragenId: number;
  actorUserId: number;
}): Promise<MemeModerationView> {
  const latestRun = await prisma.quiz_interaction_runs.findFirst({
    where: {
      quiz_id: input.quizId,
      quiz_fragen_id: input.quizFragenId,
      interaction_type: "MEME_CAPTION",
    },
    orderBy: { interaction_run_id: "desc" },
  });
  if (!latestRun) return { phase: "UNAVAILABLE" };
  if (
    latestRun.state === "LOCKED" ||
    latestRun.state === "OPEN" ||
    latestRun.state === "COUNTDOWN"
  ) {
    return { phase: "NOT_READY", interactionState: latestRun.state };
  }

  return prisma.$transaction(async (tx) => {
    await lockRun(tx, latestRun.interaction_run_id);
    const run = await tx.quiz_interaction_runs.findUniqueOrThrow({
      where: { interaction_run_id: latestRun.interaction_run_id },
    });
    if (
      run.quiz_id !== input.quizId ||
      run.quiz_fragen_id !== input.quizFragenId ||
      run.interaction_type !== "MEME_CAPTION"
    ) {
      throw new Error("Der Meme-Run gehört nicht zu dieser Quizfrage.");
    }
    if (run.state !== "CLOSED" && run.state !== "REVEALED") {
      return { phase: "NOT_READY", interactionState: run.state as "LOCKED" | "OPEN" | "COUNTDOWN" };
    }

    const existing = await tx.meme_moderation_selections.findUnique({
      where: { interaction_run_id: run.interaction_run_id },
      include: selectionInclude,
    });
    if (existing) return toView(existing);

    const config = readMemeLiveConfigSnapshot(run.config_snapshot);
    if (!config) throw new Error("Die gespeicherte Meme-Konfiguration ist ungültig.");
    const stored = await tx.team_answer_submissions.findMany({
      where: { interaction_run_id: run.interaction_run_id },
      select: {
        team_answer_submission_id: true,
        interaction_run_id: true,
        quiz_team_session_id: true,
        submission_version: true,
        status: true,
        interaction_type: true,
        payload: true,
      },
    });
    const valid = collectValidMemeSubmissions(
      run.interaction_run_id,
      stored as StoredMemeSubmission[],
    );
    const plan = createMemeSelectionPlan(valid, config.maxPresentedMemes);
    const created = await tx.meme_moderation_selections.create({
      data: {
        interaction_run_id: run.interaction_run_id,
        quiz_fragen_id: input.quizFragenId,
        valid_submission_count: plan.validSubmissionCount,
        selection_limit: config.maxPresentedMemes,
        created_by_user_id: input.actorUserId,
        candidates: {
          create: plan.selected.map((submission, index) => ({
            team_answer_submission_id: submission.team_answer_submission_id,
            position: index + 1,
          })),
        },
      },
      include: selectionInclude,
    });
    return toView(created);
  }, { timeout: 30_000 });
}

export async function setMemeCandidateReviewStatus(input: {
  quizId: number;
  quizFragenId: number;
  selectionId: number;
  candidateId: number;
  expectedReviewRevision: number;
  reviewStatus: Exclude<MemeReviewStatus, "PENDING_REVIEW">;
  actorUserId: number;
}) {
  return prisma.$transaction(async (tx) => {
    await lockSelection(tx, input.selectionId);
    const selection = await tx.meme_moderation_selections.findFirst({
      where: {
        meme_moderation_selection_id: input.selectionId,
        quiz_fragen_id: input.quizFragenId,
        interaction_run: { quiz_id: input.quizId },
      },
    });
    if (!selection) throw new Error("Die Meme-Auswahl gehört nicht zu diesem Quiz.");
    if (selection.state !== "REVIEWING") {
      return { success: false as const, reason: "REVIEW_COMPLETED" as const, view: toView(await readSelection(tx, input.selectionId)) };
    }

    const updated = await tx.meme_moderation_candidates.updateMany({
      where: {
        meme_moderation_candidate_id: input.candidateId,
        meme_moderation_selection_id: input.selectionId,
        review_revision: input.expectedReviewRevision,
      },
      data: {
        review_status: input.reviewStatus,
        review_revision: { increment: 1 },
        reviewed_by_user_id: input.actorUserId,
        reviewed_at: new Date(),
      },
    });
    if (updated.count !== 1) {
      return { success: false as const, reason: "REVISION_CONFLICT" as const, view: toView(await readSelection(tx, input.selectionId)) };
    }
    await tx.meme_moderation_selections.update({
      where: { meme_moderation_selection_id: input.selectionId },
      data: { revision: { increment: 1 } },
    });
    return { success: true as const, view: toView(await readSelection(tx, input.selectionId)) };
  });
}

export async function completeMemeModerationReview(input: {
  quizId: number;
  quizFragenId: number;
  selectionId: number;
  expectedRevision: number;
  actorUserId: number;
}) {
  return prisma.$transaction(async (tx) => {
    await lockSelection(tx, input.selectionId);
    const selection = await tx.meme_moderation_selections.findFirst({
      where: {
        meme_moderation_selection_id: input.selectionId,
        quiz_fragen_id: input.quizFragenId,
        interaction_run: { quiz_id: input.quizId },
      },
      include: selectionInclude,
    });
    if (!selection) throw new Error("Die Meme-Auswahl gehört nicht zu diesem Quiz.");
    if (selection.revision !== input.expectedRevision) {
      return { success: false as const, reason: "REVISION_CONFLICT" as const, message: "Der Review wurde inzwischen geändert. Der aktuelle Stand wurde geladen.", view: toView(selection) };
    }
    if (selection.state !== "REVIEWING") {
      return { success: true as const, view: toView(selection) };
    }
    const validation = validateMemeReviewCompletion({
      candidateStatuses: selection.candidates.map((item) => item.review_status),
    });
    if (!validation.ok) {
      return { success: false as const, reason: validation.reason, message: validation.message, view: toView(selection) };
    }
    await tx.meme_moderation_selections.update({
      where: { meme_moderation_selection_id: input.selectionId },
      data: {
        state: validation.nextState,
        revision: { increment: 1 },
        finalized_by_user_id: input.actorUserId,
        finalized_at: new Date(),
      },
    });
    return { success: true as const, view: toView(await readSelection(tx, input.selectionId)) };
  });
}

export type ApprovedMemeCandidate = {
  submissionId: number;
  quizFragenId: number;
  teamId: number;
  captions: Record<string, string>;
  layout: ResolvedMemeCaptionLayout;
  position: number;
  reviewStatus: "APPROVED";
  selected: true;
};

export async function readApprovedMemeCandidatesForAp3(input: {
  quizId: number;
  quizFragenId: number;
}): Promise<ApprovedMemeCandidate[]> {
  const selection = await prisma.meme_moderation_selections.findFirst({
    where: {
      quiz_fragen_id: input.quizFragenId,
      state: "COMPLETED",
      interaction_run: { quiz_id: input.quizId },
    },
    orderBy: { interaction_run_id: "desc" },
    include: {
      interaction_run: { select: { config_snapshot: true } },
      candidates: {
        where: { review_status: "APPROVED" },
        orderBy: { position: "asc" },
        include: {
          submission: {
            include: {
              quiz_team_session: { select: { team_id: true } },
            },
          },
        },
      },
    },
  });
  if (!selection) return [];
  const interaction = readInteractionSnapshot(selection.interaction_run.config_snapshot);
  const layout = interaction.type === "MEME_CAPTION"
    ? resolveMemeCaptionLayout(interaction.layout)
    : resolveMemeCaptionLayout(null);
  return selection.candidates.map((candidate) => {
    const payload = parseMemeCaptionPayload(candidate.submission.payload);
    if (!payload) throw new Error("Ein freigegebener Meme-Kandidat ist ungültig.");
    return {
      submissionId: candidate.team_answer_submission_id,
      quizFragenId: selection.quiz_fragen_id,
      teamId: candidate.submission.quiz_team_session.team_id,
      captions: memeCaptionPayloadValues(payload).captions,
      layout,
      position: candidate.position,
      reviewStatus: "APPROVED",
      selected: true,
    };
  });
}
