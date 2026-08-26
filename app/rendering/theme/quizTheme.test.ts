import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAnswerFormTemplate,
  resolvePresentationTemplate,
} from "../templateResolver";
import { contrastRatio } from "../presentationTemplates/presentationTemplate";
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
  assert.equal(style["--quiz-correct"], theme.semantic.correct);
  assert.equal(style["--quiz-danger"], theme.semantic.danger);
  assert.equal(style["--brand-primary"], theme.colors.primary);
  assert.equal(style["--brand-correct"], theme.semantic.correct);
  assert.equal(style["--quiz-ui-text"], theme.ui.text);
  assert.equal(style["--quiz-ui-primary"], theme.ui.primary);
  assert.equal(style.fontFamily, theme.appearance.fontFamily);
});

test("answer forms resolve an accessible UI palette independently of presentation colors", () => {
  for (const templateId of ["lovd-ungegoogelt", "ungegoogelt-default"]) {
    const theme = createTheme(templateId, templateId);

    if (templateId === "lovd-ungegoogelt") {
      assert.equal(theme.colors.background, "#74291d");
      assert.equal(theme.colors.text, "#f6efe4");
      assert.equal(theme.ui.background, "#f8f4ee");
      assert.equal(theme.ui.text, "#24120e");
    }

    const checks = [
      ["main text", theme.ui.text, theme.ui.surface, 4.5],
      ["muted text", theme.ui.textMuted, theme.ui.surface, 4.5],
      ["control border", theme.ui.border, theme.ui.surface, 3],
      ["primary button", theme.ui.primaryText, theme.ui.primary, 4.5],
      ["focus indicator", theme.ui.focus, theme.ui.surface, 3],
      ["success", theme.ui.success, theme.ui.successSurface, 4.5],
      ["warning", theme.ui.warning, theme.ui.warningSurface, 4.5],
      ["danger", theme.ui.danger, theme.ui.dangerSurface, 4.5],
      ["disabled", theme.ui.disabledText, theme.ui.disabledSurface, 3],
    ] as const;

    for (const [label, foreground, background, minimum] of checks) {
      assert.ok(
        contrastRatio(foreground, background) >= minimum,
        `${templateId}: ${label}`,
      );
    }
  }
});
