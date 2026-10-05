import assert from "node:assert/strict";
import test from "node:test";
import type { QuestionTemplateConfig, QuestionTemplateData } from "@/app/fragen/editor/types";
import { canPublishParticipantMedium, isParticipantSolutionReleased, projectParticipantQuestionContent } from "./participantQuestionProjection";

const openedAt = new Date("2026-10-05T08:00:00Z");
const context = { state: "OPEN", isHidden: false, openedAt, releasedAt: openedAt };
function config(templateData: QuestionTemplateData): QuestionTemplateConfig {
  return { stageDurationsSeconds: { stage1: 15, stage2: 15, stage3: 15 },
    createPixelQuestionByAnswer: { answer1: false, answer2: false }, templateData };
}
for (const response of ["YEAR", "COUNTRY", "TEXT"] as const) {
  for (const state of ["OPEN", "COUNTDOWN", "CLOSED", "LOCKED", "UNKNOWN", null, undefined]) {
    test(`${response}: ${state} does not publish editorial solution or variants`, () => {
      const input = config({ kind: "FACTS", response, facts: [{ id: "1", text: "Public clue" }],
        solution: "secret-solution", acceptedVariants: ["secret-alias"],
        options: [{ id: "secret-option", text: "secret-option-text", isCorrect: true }] });
      Object.assign(input, { futureSecret: "future-secret" });
      Object.assign(input.templateData!, { futureNestedSecret: "nested-secret" });
      const payload = projectParticipantQuestionContent(input,
        [{ antwort_id: 1, antwort: "internal-answer", ist_richtig: true }], { ...context, state });
      assert.deepEqual(payload, { templateConfig: { templateData: {
        kind: "FACTS", response, facts: [{ id: "1", text: "Public clue" }],
      } }, resolution: null });
      assert.equal(/secret|internal-answer/u.test(JSON.stringify(payload)), false);
      assert.equal(input.templateData?.kind === "FACTS" && input.templateData.solution, "secret-solution");
    });
  }
  test(`${response}: release publishes canonical solution, keeps evaluation aliases internal`, () => {
    const input = config({ kind: "FACTS", response, facts: [], solution: "canonical",
      acceptedVariants: ["internal-alias"], options: [] });
    assert.deepEqual(projectParticipantQuestionContent(input, [], { ...context, state: "REVEALED" }).resolution,
      { answers: ["canonical"], correctOptionIds: [] });
  });
}
test("reset epoch, hidden run and incomplete reveal fail closed", () => {
  for (const invalid of [
    { releasedAt: new Date(openedAt.getTime() + 1) }, { openedAt: null },
    { releasedAt: null }, { isHidden: true },
  ]) assert.equal(isParticipantSolutionReleased({ ...context, state: "REVEALED", ...invalid }), false);
  assert.equal(isParticipantSolutionReleased({ ...context, state: "REVEALED" }), true);
  assert.equal(isParticipantSolutionReleased(context), false);
});
test("true/false and estimation editorial data remain private after finalization", () => {
  for (const data of [
    { kind: "TRUE_FALSE", correctAnswer: true, explanation: "secret explanation" },
    { kind: "ESTIMATE", correctValue: 1234, unit: "km", numberFormat: "INTEGER", explanation: "secret", tolerance: 2 },
  ] as QuestionTemplateData[]) {
    assert.deepEqual(projectParticipantQuestionContent(config(data), [], { ...context, state: "CLOSED" }),
      { templateConfig: null, resolution: null });
    assert.ok(projectParticipantQuestionContent(config(data), [], { ...context, state: "REVEALED" }).resolution);
  }
});
test("choice answer keys are scoped to revealed question, never finalization", () => {
  const options = [ { antwort_id: 1, antwort: "Correct", ist_richtig: true },
    { antwort_id: 2, antwort: "Wrong", ist_richtig: false } ];
  assert.equal(projectParticipantQuestionContent(null, options, context).resolution, null);
  assert.deepEqual(projectParticipantQuestionContent(null, options, { ...context, state: "REVEALED" }).resolution,
    { answers: ["Correct"], correctOptionIds: [1] });
  assert.equal(projectParticipantQuestionContent(null, options, { ...context, state: "CLOSED" }).resolution, null);
});
test("unknown editorial config fields and unrelated template metadata never escape", () => {
  const data = config({ kind: "ANAGRAM", name: "secret-name", suggestions: ["secret"],
    selectedSolution: "secret-solution", wordCountPreference: "ANY" });
  assert.deepEqual(projectParticipantQuestionContent(data, [], context), { templateConfig: null, resolution: null });
});

test("solution images and future unknown media slots cannot escape before valid reveal", () => {
  for (const slot of ["answer_image", "pixel_original_image", "face_morph_person_a_original", "face_morph_person_b_original"]) {
    for (const state of ["OPEN", "COUNTDOWN", "CLOSED", "UNKNOWN"]) {
      assert.equal(canPublishParticipantMedium(slot, { ...context, state }), false);
    }
    assert.equal(canPublishParticipantMedium(slot, { ...context, state: "REVEALED" }), true);
    assert.equal(canPublishParticipantMedium(slot, { ...context, state: "REVEALED", releasedAt: new Date(openedAt.getTime()+1) }), false);
  }
  assert.equal(canPublishParticipantMedium("future_secret_image", { ...context, state: "REVEALED" }), false);
  for (const slot of [null, "question_image", "pixel_stage_1_image", "face_morph_result"]) {
    assert.equal(canPublishParticipantMedium(slot, context), true);
  }
});
