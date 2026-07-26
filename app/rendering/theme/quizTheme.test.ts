import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAnswerFormTemplate,
  resolvePresentationTemplate,
} from "../templateResolver";
import { quizThemeStyle, resolveQuizTheme } from "./quizTheme";

function createTheme(
  presentationId: string | null,
  answerFormId: string | null,
) {
  return resolveQuizTheme({
    displayName: "Sommerquiz",
    presentation: resolvePresentationTemplate({
      quizTemplateId: presentationId,
      eventSeriesTemplateId: null,
    }),
    answerForm: resolveAnswerFormTemplate({
      quizTemplateId: answerFormId,
      eventSeriesTemplateId: null,
    }),
  });
}

test("legacy templates resolve to one complete serializable theme", () => {
  const theme = createTheme("ungegoogelt-dark", "minimal");

  assert.equal(theme.version, 1);
  assert.equal(theme.identity.displayName, "Sommerquiz");
  assert.equal(theme.source.presentationTemplateId, "ungegoogelt-dark");
  assert.equal(theme.source.answerFormTemplateId, "minimal");
  assert.equal(theme.presentation.variant, "DARK");
  assert.equal(theme.answerForm.variant, "MINIMAL");
  assert.equal(theme.appearance.densityPreset, "COMPACT");
  assert.doesNotThrow(() => JSON.stringify(theme));
});

test("answer form variants cannot replace the presentation brand identity", () => {
  const branded = createTheme("ungegoogelt-default", "ungegoogelt-default");
  const minimal = createTheme("ungegoogelt-default", "minimal");

  assert.deepEqual(minimal.colors, branded.colors);
  assert.equal(minimal.identity.logoUrl, branded.identity.logoUrl);
  assert.equal(minimal.answerForm.variant, "MINIMAL");
});

test("unknown legacy ids fall back independently and report both fallbacks", () => {
  const theme = createTheme("removed-presentation", "removed-answer-form");

  assert.equal(theme.source.presentationTemplateId, "ungegoogelt-default");
  assert.equal(theme.source.answerFormTemplateId, "ungegoogelt-default");
  assert.equal(theme.source.presentationUsedFallback, true);
  assert.equal(theme.source.answerFormUsedFallback, true);
});

test("theme style exposes quiz variables and compatibility aliases", () => {
  const theme = createTheme("ungegoogelt-dark", "minimal");
  const style = quizThemeStyle(theme);

  assert.equal(style["--quiz-primary"], theme.colors.primary);
  assert.equal(style["--quiz-danger"], theme.semantic.danger);
  assert.equal(style["--brand-primary"], theme.colors.primary);
  assert.equal(style.fontFamily, theme.appearance.fontFamily);
});
