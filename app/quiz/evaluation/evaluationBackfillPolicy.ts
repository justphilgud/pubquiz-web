export const QUIZ_EVALUATION_BACKFILL_BATCH_QUESTION_LIMIT = 3;

export type IncompleteEvaluationQuestion = {
  quizQuestionId: number;
  incompleteAnswers: number;
};

export function summarizeIncompleteEvaluations(
  questions: readonly IncompleteEvaluationQuestion[],
) {
  return {
    isComplete: questions.length === 0,
    incompleteAnswers: questions.reduce(
      (total, question) => total + question.incompleteAnswers,
      0,
    ),
    affectedQuestions: questions.length,
  };
}

export function selectEvaluationBackfillBatch(
  questions: readonly IncompleteEvaluationQuestion[],
  afterQuestionId: number | null,
) {
  const ordered = [...questions].sort(
    (left, right) => left.quizQuestionId - right.quizQuestionId,
  );
  const afterCursor =
    afterQuestionId === null
      ? ordered
      : ordered.filter(
          (question) => question.quizQuestionId > afterQuestionId,
        );
  return (afterCursor.length > 0 ? afterCursor : ordered).slice(
    0,
    QUIZ_EVALUATION_BACKFILL_BATCH_QUESTION_LIMIT,
  );
}

export async function processEvaluationBackfillCandidates(
  candidates: readonly IncompleteEvaluationQuestion[],
  recalculate: (quizQuestionId: number) => Promise<{
    recalculatedAnswers: number;
    recalculatedQuestions: number;
  }>,
) {
  let recalculatedAnswers = 0;
  let recalculatedQuestions = 0;
  const failedQuestionIds: number[] = [];

  for (const candidate of candidates.slice(
    0,
    QUIZ_EVALUATION_BACKFILL_BATCH_QUESTION_LIMIT,
  )) {
    try {
      const result = await recalculate(candidate.quizQuestionId);
      recalculatedAnswers += result.recalculatedAnswers;
      recalculatedQuestions += result.recalculatedQuestions;
    } catch {
      failedQuestionIds.push(candidate.quizQuestionId);
    }
  }

  return {
    recalculatedAnswers,
    recalculatedQuestions,
    attemptedQuestions: Math.min(
      candidates.length,
      QUIZ_EVALUATION_BACKFILL_BATCH_QUESTION_LIMIT,
    ),
    failedQuestionIds,
  };
}
