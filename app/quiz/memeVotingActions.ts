"use server";

import { resolveParticipantSession } from "@/app/quiz/participantSession.server";
import { requireQuizLiveController } from "@/app/quiz/quizAccess.server";
import {
  getMemePresentationSnapshot,
  startMemePresentation,
  submitMemeVote,
  transitionMemePresentationState,
} from "@/app/quiz/memeVoting.server";
import type { MemePresentationTransition } from "@/app/quiz/memeVoting";

function requirePositiveId(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} ist ungültig.`);
  }
}

const allowedTransitions = new Set<MemePresentationTransition>([
  "PREVIOUS_CANDIDATE",
  "NEXT_CANDIDATE",
  "PREVIOUS_OVERVIEW_PAGE",
  "NEXT_OVERVIEW_PAGE",
  "OPEN_VOTING",
  "CLOSE_VOTING",
]);

export async function startMemePresentationAction(input: {
  quizId: number;
  quizFragenId: number;
  selectionId: number;
}) {
  requirePositiveId(input.quizId, "Quiz-ID");
  requirePositiveId(input.quizFragenId, "Quizfragen-ID");
  requirePositiveId(input.selectionId, "Auswahl-ID");
  const access = await requireQuizLiveController(input.quizId);
  const result = await startMemePresentation({
    ...input,
    actorUserId: Number(access.session.user.id),
  });
  return {
    ...result,
    view: await getMemePresentationSnapshot({
      quizId: input.quizId,
      quizFragenId: input.quizFragenId,
      includeModeration: true,
    }),
  };
}

export async function transitionMemePresentationAction(input: {
  quizId: number;
  quizFragenId: number;
  presentationId: number;
  expectedRevision: number;
  transition: MemePresentationTransition;
}) {
  requirePositiveId(input.quizId, "Quiz-ID");
  requirePositiveId(input.quizFragenId, "Quizfragen-ID");
  requirePositiveId(input.presentationId, "Präsentations-ID");
  requirePositiveId(input.expectedRevision, "Revision");
  if (!allowedTransitions.has(input.transition)) {
    throw new Error("Der Präsentationsübergang ist ungültig.");
  }
  const access = await requireQuizLiveController(input.quizId);
  const result = await transitionMemePresentationState({
    ...input,
    actorUserId: Number(access.session.user.id),
  });
  return {
    ...result,
    view: await getMemePresentationSnapshot({
      quizId: input.quizId,
      quizFragenId: input.quizFragenId,
      includeModeration: true,
    }),
  };
}

export async function submitMemeVoteAction(input: {
  quizId: number;
  presentationId: number;
  candidateId: number;
  expectedVoteRevision: number | null;
  quizTeamSessionToken: string;
}) {
  requirePositiveId(input.quizId, "Quiz-ID");
  requirePositiveId(input.presentationId, "Präsentations-ID");
  requirePositiveId(input.candidateId, "Kandidaten-ID");
  if (
    input.expectedVoteRevision !== null &&
    (!Number.isSafeInteger(input.expectedVoteRevision) || input.expectedVoteRevision <= 0)
  ) {
    throw new Error("Die Vote-Revision ist ungültig.");
  }
  const participantSession = await resolveParticipantSession(
    input.quizId,
    input.quizTeamSessionToken,
  );
  if (!participantSession) {
    throw new Error("Ungültige oder abgelaufene Team-Sitzung.");
  }
  return submitMemeVote({
    quizId: input.quizId,
    presentationId: input.presentationId,
    candidateId: input.candidateId,
    quizTeamSessionId: participantSession.quiz_team_session_id,
    expectedVoteRevision: input.expectedVoteRevision,
  });
}
