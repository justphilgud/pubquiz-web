import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_QUIZ_ANSWER_EVALUATION_VERSION,
  isEvaluationComplete,
} from "./evaluationCompleteness";

const complete = {
  auto_basis_punkte: "0.5",
  auto_endpunkte: "1",
  vergebene_punkte: "1",
  bewertungsstatus: "PARTIAL",
  bewertungsquelle: "AUTO",
  bewertungsdetails: { strategy: "STRUCTURED_FIELDS" },
  bewertungs_version: CURRENT_QUIZ_ANSWER_EVALUATION_VERSION,
};

test("current automatic evaluation with details is complete", () => {
  assert.equal(isEvaluationComplete(complete), true);
});

test("old, partial and detail-less automatic evaluations need backfill", () => {
  assert.equal(
    isEvaluationComplete({ ...complete, bewertungs_version: 0 }),
    false,
  );
  assert.equal(
    isEvaluationComplete({ ...complete, auto_endpunkte: null }),
    false,
  );
  assert.equal(
    isEvaluationComplete({ ...complete, bewertungsdetails: null }),
    false,
  );
});

test("manual and legacy evaluations do not require engine details", () => {
  assert.equal(
    isEvaluationComplete({
      ...complete,
      bewertungsquelle: "MANUAL",
      bewertungsdetails: null,
    }),
    true,
  );
});
