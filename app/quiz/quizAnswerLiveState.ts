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
