export type QuizQuestionOrderIdentity = {
  quiz_fragen_id: number;
  sortierung: number | null;
};

export function compareQuizQuestionAssignments(
  left: QuizQuestionOrderIdentity,
  right: QuizQuestionOrderIdentity,
) {
  if (left.sortierung === null && right.sortierung !== null) return 1;
  if (left.sortierung !== null && right.sortierung === null) return -1;

  return (
    (left.sortierung ?? 0) - (right.sortierung ?? 0) ||
    left.quiz_fragen_id - right.quiz_fragen_id
  );
}

export function sortQuizQuestionAssignments<
  TQuestion extends QuizQuestionOrderIdentity,
>(questions: readonly TQuestion[]) {
  return [...questions].sort(compareQuizQuestionAssignments);
}
