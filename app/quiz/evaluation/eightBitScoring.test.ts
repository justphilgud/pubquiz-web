import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBaseAnswer } from "./evaluateBaseAnswer";
import { evaluateQuestionPoints } from "./evaluateQuestionPoints";
import { getQuestionBaseMaximum, getQuizQuestionScoringTemplateId, validateQuestionPointsMode } from "./questionPointPolicy";
import { getQuizQuestionPointsDisplay } from "./quizQuestionPointsDisplay";
import { getQuestionTemplatePersistenceIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { Prisma } from "@/app/generated/prisma/client";

for (const templateId of getQuestionTemplatePersistenceIds("eight_bit")) {
  test(`${templateId}: correct, variant, wrong and empty title; maximum and expert agree`, () => {
    const input = { templateId, effectiveAnswerMode: "OPEN" as const, answerOptions: [], selectedAnswerIds: [],
      answerText: null, structuredFields: [{ id: 1, acceptedSolutions: ["Radioactive", "Radioaktiv"] }],
      structuredAnswers: new Map<number, string>(), orderingItems: [] };
    const policy = { templateId, correctAnswerCount: 0, structuredFieldCount: 1, orderingItemCount: 0 };
    const maximum = getQuestionBaseMaximum(policy);
    assert.equal(maximum.toString(), "1");
    assert.equal(getQuizQuestionPointsDisplay({ templateId, pointsMode: "standard", basePoints: maximum.toString() }).pointsLabel, "max. 1 Punkt");
    for (const [text, status, points] of [["Radioactive", "CORRECT", "1"], ["  RADIOAKTIV ", "CORRECT", "1"], ["Other", "WRONG", "0"], ["", "UNANSWERED", "0"]]) {
      const result = evaluateBaseAnswer({ ...input, structuredAnswers: new Map([[1, text]]) });
      assert.equal(result.status, status);
      assert.equal(result.basePoints.toString(), points);
      assert.equal(result.maxPoints.toString(), "1");
      assert.equal(evaluateQuestionPoints(result, "expertenbonus").finalPoints.toNumber(), Number(points) * 2);
    }
    assert.doesNotThrow(() => validateQuestionPointsMode({ ...policy, pointsMode: "risikofrage" }));
  });
}

test("legacy two-field 8-bit preserves partial credit and caps the total at one", () => {
  const input = { templateId: "eight_bit", effectiveAnswerMode: "OPEN" as const, answerOptions: [], selectedAnswerIds: [],
    answerText: null, structuredFields: [{ id: 1, acceptedSolutions: ["Radioactive"] }, { id: 2, acceptedSolutions: ["Imagine Dragons"] }],
    orderingItems: [] };
  assert.equal(evaluateBaseAnswer({ ...input, structuredAnswers: new Map([[1, "Radioactive"]]) }).basePoints.toString(), "0.5");
  assert.equal(evaluateBaseAnswer({ ...input, structuredAnswers: new Map([[1, "Radioactive"], [2, "Imagine Dragons"]]) }).basePoints.toString(), "1");
  assert.throws(() => validateQuestionPointsMode({ templateId: "eight_bit", pointsMode: "risikofrage", structuredFieldCount: 2, correctAnswerCount: 0, orderingItemCount: 0 }));
});

test("legacy free-text 8-bit still awards one point", () => {
  const result = evaluateBaseAnswer({ templateId: "eight_bit", effectiveAnswerMode: "OPEN", answerOptions: [{ id: 1, text: "Radioactive", isCorrect: true }], selectedAnswerIds: [],
    answerText: "Radioactive", structuredFields: [], structuredAnswers: new Map(), orderingItems: [] });
  assert.equal(result.basePoints.toString(), "1");
});

test("custom 8bit uses one point for new and migrated assignments and preserves historical scoring", () => {
  const snapshot = { version: 1, scoringTemplateId: "eight_bit" };
  const base = {
    effectiveAnswerMode: "OPEN" as const, answerOptions: [], selectedAnswerIds: [],
    answerText: null, structuredFields: [{ id: 7, acceptedSolutions: ["Songtitel"] }],
    orderingItems: [],
  };
  for (const maximum of [undefined, new Prisma.Decimal(1), new Prisma.Decimal("0.5")]) {
    const templateId = getQuizQuestionScoringTemplateId("musik", snapshot, maximum);
    const correctPoints = maximum?.eq("0.5") ? 0.5 : 1;
    for (const [answer, expected] of [["Songtitel", correctPoints], ["Falsch", 0], ["", 0]] as const) {
      const result = evaluateBaseAnswer({ ...base, templateId, structuredAnswers: new Map([[7, answer]]) });
      assert.equal(result.maxPoints.toNumber(), correctPoints);
      assert.equal(evaluateQuestionPoints(result, "standard").finalPoints.toNumber(), expected);
      assert.equal(evaluateQuestionPoints(result, "expertenbonus").finalPoints.toNumber(), expected * 2);
    }
  }
  assert.equal(getQuizQuestionScoringTemplateId("musik", { version: 1 }), "musik");
  assert.equal(getQuizQuestionScoringTemplateId("kunstwerk", snapshot), "kunstwerk");
});
