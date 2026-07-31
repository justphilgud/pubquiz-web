import assert from "node:assert/strict";
import test from "node:test";
import {
  processEvaluationBackfillCandidates,
  QUIZ_EVALUATION_BACKFILL_BATCH_QUESTION_LIMIT,
  selectEvaluationBackfillBatch,
  summarizeIncompleteEvaluations,
} from "./evaluationBackfillPolicy";

const incompleteQuestions = Array.from({ length: 5 }, (_, index) => ({
  quizQuestionId: index + 1,
  incompleteAnswers: index + 2,
}));

test("summarizes incomplete answers and affected questions", () => {
  assert.deepEqual(summarizeIncompleteEvaluations(incompleteQuestions), {
    isComplete: false,
    incompleteAnswers: 20,
    affectedQuestions: 5,
  });
  assert.deepEqual(summarizeIncompleteEvaluations([]), {
    isComplete: true,
    incompleteAnswers: 0,
    affectedQuestions: 0,
  });
});

test("selects a bounded resumable batch and wraps after the last cursor", () => {
  assert.equal(QUIZ_EVALUATION_BACKFILL_BATCH_QUESTION_LIMIT, 3);
  assert.deepEqual(
    selectEvaluationBackfillBatch(incompleteQuestions, null).map(
      (question) => question.quizQuestionId,
    ),
    [1, 2, 3],
  );
  assert.deepEqual(
    selectEvaluationBackfillBatch(incompleteQuestions, 3).map(
      (question) => question.quizQuestionId,
    ),
    [4, 5],
  );
  assert.deepEqual(
    selectEvaluationBackfillBatch(incompleteQuestions, 5).map(
      (question) => question.quizQuestionId,
    ),
    [1, 2, 3],
  );
});

test("processes at most one batch and continues after a question fails", async () => {
  const visited: number[] = [];
  const result = await processEvaluationBackfillCandidates(
    incompleteQuestions,
    async (quizQuestionId) => {
      visited.push(quizQuestionId);
      if (quizQuestionId === 2) {
        throw new Error("expected test failure");
      }
      return { recalculatedAnswers: 2, recalculatedQuestions: 1 };
    },
  );

  assert.deepEqual(visited, [1, 2, 3]);
  assert.deepEqual(result, {
    recalculatedAnswers: 4,
    recalculatedQuestions: 2,
    attemptedQuestions: 3,
    failedQuestionIds: [2],
  });
});

test("an empty completed batch is idempotent", async () => {
  let recalculations = 0;
  const result = await processEvaluationBackfillCandidates([], async () => {
    recalculations += 1;
    return { recalculatedAnswers: 1, recalculatedQuestions: 1 };
  });

  assert.equal(recalculations, 0);
  assert.deepEqual(result, {
    recalculatedAnswers: 0,
    recalculatedQuestions: 0,
    attemptedQuestions: 0,
    failedQuestionIds: [],
  });
});
