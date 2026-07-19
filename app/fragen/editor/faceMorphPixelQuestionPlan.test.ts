import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFaceMorphPixelQuestionPlan,
  hasActiveCoupledQuestionInQuiz,
  runFaceMorphPixelQuestionGenerators,
} from "./faceMorphPixelQuestionPlan";

const sources = [
  { answerPosition: 1 as const, imageUrl: "https://blob.test/a.jpg" },
  { answerPosition: 2 as const, imageUrl: "https://blob.test/b.jpg" },
];

test("FaceMorph pixel plan creates zero, one, or two child questions", () => {
  assert.deepEqual(buildFaceMorphPixelQuestionPlan({ answer1: false, answer2: false }, sources, []).map((entry) => entry.action), ["NONE", "NONE"]);
  assert.deepEqual(buildFaceMorphPixelQuestionPlan({ answer1: true, answer2: false }, sources, []).map((entry) => entry.action), ["CREATE", "NONE"]);
  assert.deepEqual(buildFaceMorphPixelQuestionPlan({ answer1: true, answer2: true }, sources, []).map((entry) => entry.action), ["CREATE", "CREATE"]);
});

test("FaceMorph pixel plan reuses relations idempotently and detects an image change", () => {
  const relations = [
    { answerPosition: 1 as const, childQuestionId: 41, active: true, inputImageUrl: sources[0].imageUrl },
    { answerPosition: 2 as const, childQuestionId: 42, active: true, inputImageUrl: "https://blob.test/old.jpg" },
  ];
  const plan = buildFaceMorphPixelQuestionPlan({ answer1: true, answer2: true }, sources, relations);
  assert.deepEqual(plan, [
    { action: "REUSE", answerPosition: 1, childQuestionId: 41, imageUrl: sources[0].imageUrl, imageChanged: false, reactivate: false },
    { action: "REUSE", answerPosition: 2, childQuestionId: 42, imageUrl: sources[1].imageUrl, imageChanged: true, reactivate: false },
  ]);
});

test("FaceMorph pixel plan deactivates without deleting and can reactivate the same child", () => {
  const relation = [{ answerPosition: 1 as const, childQuestionId: 41, active: true, inputImageUrl: sources[0].imageUrl }];
  assert.deepEqual(buildFaceMorphPixelQuestionPlan({ answer1: false, answer2: false }, sources, relation)[0], {
    action: "DEACTIVATE", answerPosition: 1, childQuestionId: 41,
  });
  assert.equal(
    buildFaceMorphPixelQuestionPlan(
      { answer1: true, answer2: false },
      sources,
      [{ ...relation[0], active: false }],
    )[0].action,
    "REUSE",
  );
});

test("quiz warning only considers an active coupled counterpart", () => {
  const relations = [{ sourceQuestionId: 10, childQuestionId: 20, active: true }];
  assert.equal(hasActiveCoupledQuestionInQuiz(10, new Set([20]), relations), true);
  assert.equal(hasActiveCoupledQuestionInQuiz(20, new Set([10]), relations), true);
  assert.equal(hasActiveCoupledQuestionInQuiz(10, new Set([30]), relations), false);
  assert.equal(hasActiveCoupledQuestionInQuiz(10, new Set([20]), [{ ...relations[0], active: false }]), false);
});

test("generator errors stay typed per child and can be retried independently", async () => {
  const calls: number[] = [];
  const result = await runFaceMorphPixelQuestionGenerators(
    [
      { answerPosition: 1, questionId: 41 },
      { answerPosition: 2, questionId: 42 },
    ],
    async (questionId) => {
      calls.push(questionId);
      return questionId === 41
        ? { ok: true as const }
        : { ok: false as const, code: "GENERATOR_INPUT_INVALID" };
    },
  );
  assert.deepEqual(calls, [41, 42]);
  assert.deepEqual(result, [
    { answerPosition: 1, questionId: 41, status: "SUCCEEDED" },
    { answerPosition: 2, questionId: 42, status: "FAILED", errorCode: "GENERATOR_INPUT_INVALID" },
  ]);
});
