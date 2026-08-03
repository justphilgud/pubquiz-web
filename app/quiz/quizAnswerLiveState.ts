import type { PresentationAudienceState } from "@/app/rendering/presentation/presentationLiveState";

type QuizQuestionAssignment = {
  quiz_fragen_id: number;
};

export function selectQuizAnswerAssignments<
  TAssignment extends QuizQuestionAssignment,
>(
  audienceState: PresentationAudienceState,
  assignments: readonly TAssignment[],
  legacyVisibleAssignmentIds: readonly number[] = [],
) {
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
    const visibleIds = new Set(legacyVisibleAssignmentIds);
    return assignments.filter((assignment) =>
      visibleIds.has(assignment.quiz_fragen_id),
    );
  }

  return [];
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
