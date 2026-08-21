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
      hasEffectiveSubmission: true,
      evaluation: { ...completeEvaluation, bewertungs_version: 0 },
    }),
    { isUnanswered: false, isPending: true, status: "PENDING" },
  );
});

test("uses the persisted status after evaluation completes", () => {
  assert.deepEqual(
    resolveEvaluationReadState({
      hasEffectiveSubmission: true,
      evaluation: completeEvaluation,
    }),
    { isUnanswered: false, isPending: false, status: "CORRECT" },
  );
});

test("distinguishes an absent submission from a pending evaluation", () => {
  assert.deepEqual(
    resolveEvaluationReadState({
      hasEffectiveSubmission: false,
      evaluation: null,
    }),
    { isUnanswered: true, isPending: false, status: "UNANSWERED" },
  );
});
