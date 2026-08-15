import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBaseAnswer } from "./evaluateBaseAnswer";
import { evaluateQuestionPoints } from "./evaluateQuestionPoints";
import {
  getQuestionBaseMaximum,
  validateQuestionPointsMode,
} from "./questionPointPolicy";

const defaults = {
  effectiveAnswerMode: "CLOSED" as const,
  answerOptions: [] as { id: number; isCorrect: boolean }[],
  selectedAnswerIds: [] as number[],
  answerText: null,
  structuredFields: [],
  structuredAnswers: new Map<number, string | null>(),
  orderingItems: [] as string[],
};

test("standard is binary and expert doubles the base result", () => {
  const base = evaluateBaseAnswer({
    ...defaults,
    templateId: "wahr_falsch",
    answerOptions: [{ id: 1, isCorrect: true }, { id: 2, isCorrect: false }],
    selectedAnswerIds: [1],
  });
  assert.equal(base.status, "CORRECT");
  assert.equal(base.basePoints.toString(), "1");
  assert.equal(evaluateQuestionPoints(base, "expertenbonus").finalPoints.toString(), "2");
});

test("standard wrong and empty answers stay distinct", () => {
  const wrong = evaluateBaseAnswer({
    ...defaults,
    templateId: "wahr_falsch",
    answerOptions: [{ id: 1, isCorrect: true }, { id: 2, isCorrect: false }],
    selectedAnswerIds: [2],
  });
  const empty = evaluateBaseAnswer({ ...defaults, templateId: "wahr_falsch" });
  assert.equal(wrong.status, "WRONG");
  assert.equal(empty.status, "UNANSWERED");
  assert.equal(wrong.basePoints.toString(), "0");
});

test("structured answers award half a point per matching field", () => {
  const result = evaluateBaseAnswer({
    ...defaults,
    templateId: "face_morph",
    structuredFields: [
      { id: 1, acceptedSolutions: ["Ada"] },
      { id: 2, acceptedSolutions: ["Grace"] },
    ],
    structuredAnswers: new Map([[1, " ada "], [2, "wrong"]]),
  });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.basePoints.toString(), "0.5");
  assert.equal(result.maxPoints.toString(), "1");
});

test("structured answers cover all and no matching components", () => {
  const input = {
    ...defaults,
    templateId: "face_morph",
    structuredFields: [
      { id: 1, acceptedSolutions: ["Ada"] },
      { id: 2, acceptedSolutions: ["Grace"] },
    ],
  };
  const correct = evaluateBaseAnswer({
    ...input,
    structuredAnswers: new Map([[1, "Ada"], [2, "Grace"]]),
  });
  const wrong = evaluateBaseAnswer({
    ...input,
    structuredAnswers: new Map([[1, "X"], [2, "Y"]]),
  });
  assert.equal(correct.status, "CORRECT");
  assert.equal(correct.basePoints.toString(), "1");
  assert.equal(wrong.status, "WRONG");
});

test("pixel text ignores legacy structured fields and remains manually reviewable", () => {
  const result = evaluateBaseAnswer({
    ...defaults,
    templateId: "pixelbild",
    effectiveAnswerMode: "OPEN",
    answerText: "Eiffelturm",
    structuredFields: [{ id: 1, acceptedSolutions: ["Hans Meier"] }],
  });

  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.equal(result.maxPoints.toString(), "1");
  assert.deepEqual(result.details, {
    strategy: "MANUAL",
    reason: "MANUAL_EVALUATION",
  });
});

test("multiple choice penalizes wrong selections and selecting all is not full", () => {
  const result = evaluateBaseAnswer({
    ...defaults,
    templateId: "multiple_choice",
    answerOptions: [
      { id: 1, isCorrect: true },
      { id: 2, isCorrect: true },
      { id: 3, isCorrect: false },
    ],
    selectedAnswerIds: [1, 2, 3],
  });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.basePoints.toString(), "0.5");
  assert.equal(result.maxPoints.toString(), "1");
});

test("multiple choice covers full, partial, wrong and empty selections", () => {
  const input = {
    ...defaults,
    templateId: "multiple_choice",
    answerOptions: [
      { id: 1, isCorrect: true },
      { id: 2, isCorrect: true },
      { id: 3, isCorrect: false },
      { id: 4, isCorrect: false },
    ],
  };
  assert.equal(
    evaluateBaseAnswer({ ...input, selectedAnswerIds: [1, 2] }).status,
    "CORRECT",
  );
  assert.equal(
    evaluateBaseAnswer({ ...input, selectedAnswerIds: [1] }).basePoints.toString(),
    "0.5",
  );
  assert.equal(
    evaluateBaseAnswer({ ...input, selectedAnswerIds: [3] }).basePoints.toString(),
    "0",
  );
  assert.equal(evaluateBaseAnswer(input).status, "UNANSWERED");
});

test("ordering awards a quarter point per exact position", () => {
  const result = evaluateBaseAnswer({
    ...defaults,
    templateId: "reihenfolge",
    answerText: JSON.stringify(["b", "a", "c", "d"]),
    orderingItems: ["a", "b", "c", "d"],
  });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.basePoints.toString(), "0.5");
  assert.equal(result.maxPoints.toString(), "1");
});

test("ordering covers complete and empty answers", () => {
  const input = {
    ...defaults,
    templateId: "reihenfolge",
    orderingItems: ["a", "b", "c", "d"],
  };
  const correct = evaluateBaseAnswer({
    ...input,
    answerText: JSON.stringify(input.orderingItems),
  });
  assert.equal(correct.status, "CORRECT");
  assert.equal(correct.basePoints.toString(), "1");
  assert.equal(evaluateBaseAnswer(input).status, "UNANSWERED");
});

test("invalid ordering payload requires review", () => {
  const result = evaluateBaseAnswer({
    ...defaults,
    templateId: "reihenfolge",
    answerText: JSON.stringify(["a", "a"]),
    orderingItems: ["a", "b"],
  });
  assert.equal(result.status, "REVIEW_REQUIRED");
});

test("ordering rejects malformed JSON and unknown ids safely", () => {
  const input = {
    ...defaults,
    templateId: "reihenfolge",
    orderingItems: ["a", "b"],
  };
  assert.equal(
    evaluateBaseAnswer({ ...input, answerText: "not-json" }).status,
    "REVIEW_REQUIRED",
  );
  assert.equal(
    evaluateBaseAnswer({
      ...input,
      answerText: JSON.stringify(["a", "unknown"]),
    }).status,
    "REVIEW_REQUIRED",
  );
});

test("expert mode doubles partial and zero points without floating point drift", () => {
  const partial = evaluateBaseAnswer({
    ...defaults,
    templateId: "reihenfolge",
    answerText: JSON.stringify(["a", "c", "b", "d"]),
    orderingItems: ["a", "b", "c", "d"],
  });
  const zero = { ...partial, basePoints: partial.basePoints.mul(0), status: "WRONG" as const };
  assert.equal(evaluateQuestionPoints(partial, "expertenbonus").finalPoints.toString(), "1");
  assert.equal(evaluateQuestionPoints(zero, "expertenbonus").finalPoints.toString(), "0");
});

test("punkte_basis is the derived maximum base score", () => {
  assert.equal(
    getQuestionBaseMaximum({
      templateId: "reihenfolge",
      correctAnswerCount: 0,
      structuredFieldCount: 0,
      orderingItemCount: 5,
    }).toString(),
    "1.25",
  );
  assert.equal(
    getQuestionBaseMaximum({
      templateId: "face_morph",
      correctAnswerCount: 0,
      structuredFieldCount: 2,
      orderingItemCount: 0,
    }).toString(),
    "1",
  );
  assert.equal(
    getQuestionBaseMaximum({
      templateId: "pixelbild",
      correctAnswerCount: 0,
      structuredFieldCount: 3,
      orderingItemCount: 0,
    }).toString(),
    "1",
  );
});

test("pixel and partial-capable risk combinations are rejected", () => {
  assert.throws(() =>
    validateQuestionPointsMode({
      templateId: "pixelbild",
      pointsMode: "expertenbonus",
      correctAnswerCount: 1,
      structuredFieldCount: 0,
      orderingItemCount: 0,
    }),
  );
  assert.throws(() =>
    validateQuestionPointsMode({
      templateId: "face_morph",
      pointsMode: "risikofrage",
      correctAnswerCount: 0,
      structuredFieldCount: 2,
      orderingItemCount: 0,
    }),
  );
  for (const input of [
    {
      templateId: "reihenfolge",
      correctAnswerCount: 0,
      structuredFieldCount: 0,
      orderingItemCount: 4,
    },
    {
      templateId: "multiple_choice",
      correctAnswerCount: 2,
      structuredFieldCount: 0,
      orderingItemCount: 0,
    },
    {
      templateId: "standard",
      correctAnswerCount: 0,
      structuredFieldCount: 1,
      orderingItemCount: 0,
    },
  ]) {
    assert.throws(() =>
      validateQuestionPointsMode({
        ...input,
        pointsMode: "risikofrage",
      }),
    );
  }
  assert.doesNotThrow(() =>
    validateQuestionPointsMode({
      templateId: null,
      pointsMode: "risikofrage",
      correctAnswerCount: 1,
      structuredFieldCount: 0,
      orderingItemCount: 0,
    }),
  );
});
