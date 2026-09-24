"use server";

import { prisma } from "@/app/lib/prisma";
import {
  closeQuizQuestionInteraction,
  getQuizLiveSnapshotData,
} from "@/app/quiz/interaction/interaction.server";
import {
  completeMemeModerationReview,
  getOrCreateMemeModerationView,
  setMemeCandidateReviewStatus,
} from "@/app/quiz/memeModeration.server";
import { requireQuizLiveController } from "@/app/quiz/quizAccess.server";
import { readMemeLiveConfigSnapshot } from "@/app/quiz/memeCaption";

function requirePositiveId(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} ist ungültig.`);
  }
}

export async function getMemeModerationViewAction(input: {
  quizId: number;
  quizFragenId: number;
}) {
  requirePositiveId(input.quizId, "Quiz-ID");
  requirePositiveId(input.quizFragenId, "Quizfragen-ID");
  const access = await requireQuizLiveController(input.quizId);
  await getQuizLiveSnapshotData(input.quizId, null, {
    presentationQuestionAssignmentId: input.quizFragenId,
  });
  return getOrCreateMemeModerationView({
    ...input,
    actorUserId: Number(access.session.user.id),
  });
}

export async function setMemeCandidateReviewStatusAction(input: {
  quizId: number;
  quizFragenId: number;
  selectionId: number;
  candidateId: number;
  expectedReviewRevision: number;
  reviewStatus: "APPROVED" | "REJECTED";
}) {
  requirePositiveId(input.quizId, "Quiz-ID");
  requirePositiveId(input.quizFragenId, "Quizfragen-ID");
  requirePositiveId(input.selectionId, "Auswahl-ID");
  requirePositiveId(input.candidateId, "Kandidaten-ID");
  requirePositiveId(input.expectedReviewRevision, "Review-Revision");
  if (input.reviewStatus !== "APPROVED" && input.reviewStatus !== "REJECTED") {
    throw new Error("Der Review-Status ist ungültig.");
  }
  const access = await requireQuizLiveController(input.quizId);
  return setMemeCandidateReviewStatus({
    ...input,
    actorUserId: Number(access.session.user.id),
  });
}

export async function completeMemeModerationReviewAction(input: {
  quizId: number;
  quizFragenId: number;
  selectionId: number;
  expectedRevision: number;
}) {
  requirePositiveId(input.quizId, "Quiz-ID");
  requirePositiveId(input.quizFragenId, "Quizfragen-ID");
  requirePositiveId(input.selectionId, "Auswahl-ID");
  requirePositiveId(input.expectedRevision, "Auswahl-Revision");
  const access = await requireQuizLiveController(input.quizId);
  return completeMemeModerationReview({
    ...input,
    actorUserId: Number(access.session.user.id),
  });
}

export async function closeUntimedMemeSubmissionPhaseAction(input: {
  quizId: number;
  quizFragenId: number;
}) {
  requirePositiveId(input.quizId, "Quiz-ID");
  requirePositiveId(input.quizFragenId, "Quizfragen-ID");
  await requireQuizLiveController(input.quizId);
  const run = await prisma.quiz_interaction_runs.findFirst({
    where: {
      quiz_id: input.quizId,
      quiz_fragen_id: input.quizFragenId,
      interaction_type: "MEME_CAPTION",
      is_current: true,
    },
    orderBy: { interaction_run_id: "desc" },
  });
  if (!run) throw new Error("Für diese Meme-Frage ist keine Einreichungsphase aktiv.");
  const config = readMemeLiveConfigSnapshot(run.config_snapshot);
  if (!config || config.timerEnabled) {
    throw new Error("Nur eine Meme-Runde ohne Zeitbegrenzung kann manuell beendet werden.");
  }
  const closed = await prisma.$transaction((tx) =>
    closeQuizQuestionInteraction(tx, {
      quizId: input.quizId,
      quizFragenId: input.quizFragenId,
      interactionRunId: run.interaction_run_id,
      reason: "MODERATOR_CLOSED_MEME_SUBMISSIONS",
    }),
  );
  if (!closed) throw new Error("Die Einreichungsphase hat sich inzwischen geändert.");
  return {
    state: closed.state,
    deadlineAt: closed.deadline_at?.toISOString() ?? null,
    revision: closed.revision,
  };
}
