import assert from "node:assert/strict";
import test from "node:test";
import { getAffectedQuestionIds } from "./questionSaveResult";

test("save results contain the parent question without child synchronization", () => {
  assert.deepEqual(getAffectedQuestionIds(12), [12]);
});

test("save results contain all unique child and detached question ids", () => {
  assert.deepEqual(getAffectedQuestionIds(12, {
    children: [
      { answerPosition: 1, questionId: 31, status: "SUCCEEDED" },
      { answerPosition: 2, questionId: 32, status: "FAILED" },
    ],
    detachedQuestionIds: [33, 31],
    errorCode: "FACE_MORPH_PIXEL_SYNC_FAILED",
  }), [12, 31, 32, 33]);
});
