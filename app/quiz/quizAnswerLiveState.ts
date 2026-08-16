import type { PresentationAudienceState } from "@/app/rendering/presentation/presentationLiveState";

type QuizQuestionAssignment = {
  quiz_fragen_id: number;
};

export function selectQuizAnswerAssignments<
  TAssignment extends QuizQuestionAssignment,
>(
  audienceState: PresentationAudienceState,
  assignments: readonly TAssignment[],
  releasedAssignmentIds: readonly number[] = [],
) {
  if (releasedAssignmentIds.length > 0) {
    const visibleIds = new Set(releasedAssignmentIds);
    return assignments.filter((assignment) =>
      visibleIds.has(assignment.quiz_fragen_id),
    );
  }

  if (
    audienceState.kind === "QUESTION" &&
    audienceState.phase === "QUESTION"
  ) {
    return assignments.filter(
      (assignment) =>
        assignment.quiz_fragen_id === audienceState.questionAssignmentId,
    );
  }

  if (audienceState.kind === "LEGACY") {
    return [];
  }

  return [];
}

export function selectReleasedQuizAnswerAssignmentIds(
  blockAssignmentIds: readonly number[],
  runs: readonly {
    quiz_fragen_id: number | null;
    opened_at: Date | null;
    is_current: boolean;
  }[],
  releasedAt: Date | null,
) {
  if (!releasedAt) return [];
  const openedIds = new Set(
    runs.flatMap((run) =>
      run.quiz_fragen_id !== null &&
      (run.is_current || (run.opened_at !== null && run.opened_at >= releasedAt))
        ? [run.quiz_fragen_id]
        : [],
    ),
  );
  return blockAssignmentIds.filter((assignmentId) => openedIds.has(assignmentId));
}

export function isQuizAnswerRunReleasedForWrite(input: {
  run: {
    isCurrent: boolean;
    isPixel: boolean;
    openedAt: Date | null;
  };
  assignmentSectionId: number | null;
  requestedSectionId: number;
  release: {
    isReleased: boolean;
    isClosed: boolean;
    releasedAt: Date | null;
  } | null;
}) {
  if (input.assignmentSectionId === null) return input.run.isCurrent;
  if (input.assignmentSectionId !== input.requestedSectionId) return false;
  if (input.run.isPixel && !input.run.isCurrent) return false;
  if (!input.release?.isReleased || input.release.isClosed) return false;
  return input.run.isCurrent || Boolean(
    input.run.openedAt &&
      input.release.releasedAt &&
      input.run.openedAt >= input.release.releasedAt,
  );
}

export function canSaveQuizAnswerForPresentation(
  audienceState: PresentationAudienceState,
  questionAssignmentId: number,
) {
  return (
    audienceState.kind === "QUESTION" &&
    audienceState.phase === "QUESTION" &&
    audienceState.questionAssignmentId === questionAssignmentId
  );
}

export function selectParticipantQuestionMedia<
  TMedium extends { slot_key: string | null },
>(
  templateId: string | null,
  interactionState: string | null | undefined,
  media: readonly TMedium[],
) {
  if (templateId !== "pixelbild" || interactionState === "REVEALED") {
    return media;
  }
  return media.filter((medium) => medium.slot_key !== "pixel_original_image");
}
