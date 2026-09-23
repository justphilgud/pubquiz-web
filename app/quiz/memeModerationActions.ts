"use server";

import { getQuizLiveSnapshotData } from "@/app/quiz/interaction/interaction.server";
import {
  completeMemeModerationReview,
  getOrCreateMemeModerationView,
  setMemeCandidateReviewStatus,
} from "@/app/quiz/memeModeration.server";
import { requireQuizLiveController } from "@/app/quiz/quizAccess.server";

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
