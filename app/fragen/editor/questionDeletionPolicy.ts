export type QuestionDeletionCounts = {
  quizAssignments: number;
  teamAnswers: number;
  relations: number;
  media: number;
  generatorRuns: number;
};

export type QuestionDeletionBlocker =
  | "QUESTION_IN_USE"
  | "QUESTION_HAS_RELATIONS"
  | "QUESTION_HAS_MEDIA";

export function getQuestionDeletionBlocker(
  counts: QuestionDeletionCounts,
): QuestionDeletionBlocker | null {
  if (counts.quizAssignments > 0 || counts.teamAnswers > 0) {
    return "QUESTION_IN_USE";
  }
  if (counts.relations > 0) {
    return "QUESTION_HAS_RELATIONS";
  }
  if (counts.media > 0 || counts.generatorRuns > 0) {
    return "QUESTION_HAS_MEDIA";
  }
  return null;
}
