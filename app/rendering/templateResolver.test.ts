import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAnswerFormTemplate,
  resolvePresentationTemplate,
} from "./templateResolver";

test("quiz presentation override wins over event series and system", () => {
  const resolved = resolvePresentationTemplate({
    quizTemplateId: "ungegoogelt-dark",
    eventSeriesTemplateId: "ungegoogelt-default",
  });
  assert.equal(resolved.template.id, "ungegoogelt-dark");
  assert.equal(resolved.source, "QUIZ");
});

test("event series answer form wins when the quiz has no override", () => {
  const resolved = resolveAnswerFormTemplate({
    quizTemplateId: null,
    eventSeriesTemplateId: "minimal",
  });
  assert.equal(resolved.template.id, "minimal");
  assert.equal(resolved.source, "EVENT_SERIES");
});

test("unknown stored values fall back safely and report the source", () => {
  const presentation = resolvePresentationTemplate({
    quizTemplateId: "removed",
    eventSeriesTemplateId: "also-removed",
  });
  const answerForm = resolveAnswerFormTemplate({
    quizTemplateId: "removed",
    eventSeriesTemplateId: null,
  });
  assert.equal(presentation.template.id, "ungegoogelt-default");
  assert.equal(presentation.source, "SYSTEM");
  assert.equal(presentation.usedFallback, true);
  assert.equal(answerForm.template.id, "ungegoogelt-default");
  assert.equal(answerForm.source, "SYSTEM");
});
