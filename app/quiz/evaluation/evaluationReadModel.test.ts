import assert from "node:assert/strict";
import test from "node:test";
import { CURRENT_QUIZ_ANSWER_EVALUATION_VERSION } from "./evaluationCompleteness";
import { resolveEvaluationReadState } from "./evaluationReadModel";

const completeEvaluation = {
  auto_basis_punkte: "1",
  auto_endpunkte: "1",
  vergebene_punkte: "1",
  bewertungsstatus: "CORRECT",
  bewertungsquelle: "AUTO",
  bewertungsdetails: { strategy: "SINGLE_CHOICE" },
  bewertungs_version: CURRENT_QUIZ_ANSWER_EVALUATION_VERSION,
};

test("keeps a submitted answer visible while its evaluation is pending", () => {
  assert.deepEqual(
    resolveEvaluationReadState({
      isPlayed: true,
      hasEffectiveSubmission: true,
      evaluation: { ...completeEvaluation, bewertungs_version: 0 },
    }),
    { isNotPlayed: false, isUnanswered: false, isPending: true, status: "PENDING" },
  );
});

test("uses the persisted status after evaluation completes", () => {
  assert.deepEqual(
    resolveEvaluationReadState({
      isPlayed: true,
      hasEffectiveSubmission: true,
      evaluation: completeEvaluation,
    }),
    { isNotPlayed: false, isUnanswered: false, isPending: false, status: "CORRECT" },
  );
});

test("distinguishes an absent submission from a pending evaluation", () => {
  assert.deepEqual(
    resolveEvaluationReadState({
      isPlayed: true,
      hasEffectiveSubmission: false,
      evaluation: null,
    }),
    { isNotPlayed: false, isUnanswered: true, isPending: false, status: "UNANSWERED" },
  );
});

test("distinguishes a question without an interaction run from unanswered", () => {
  assert.deepEqual(
    resolveEvaluationReadState({
      isPlayed: false,
      hasEffectiveSubmission: false,
      evaluation: null,
    }),
    {
      isNotPlayed: true,
      isUnanswered: false,
      isPending: false,
      status: "NOT_PLAYED",
    },
  );
});
