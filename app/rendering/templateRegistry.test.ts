import assert from "node:assert/strict";
import test from "node:test";
import { loadRenderingMessages } from "@/app/i18n/renderingMessages";
import {
  SYSTEM_ANSWER_FORM_TEMPLATE_ID,
  SYSTEM_PRESENTATION_TEMPLATE_ID,
  getAnswerFormTemplate,
  getPresentationTemplate,
  isSelectableAnswerFormTemplateId,
  isSelectablePresentationTemplateId,
  templateRegistry,
} from "./templateRegistry";

test("both registries contain a selectable system default and unique IDs", () => {
  assert.equal(getPresentationTemplate(SYSTEM_PRESENTATION_TEMPLATE_ID)?.selectable, true);
  assert.equal(getAnswerFormTemplate(SYSTEM_ANSWER_FORM_TEMPLATE_ID)?.selectable, true);
  assert.equal(new Set(templateRegistry.presentation.map(({ id }) => id)).size, templateRegistry.presentation.length);
  assert.equal(new Set(templateRegistry.answerForm.map(({ id }) => id)).size, templateRegistry.answerForm.length);
});

test("unknown IDs are rejected and only selectable templates are offered", () => {
  assert.equal(isSelectablePresentationTemplateId("missing"), false);
  assert.equal(isSelectableAnswerFormTemplateId("missing"), false);
  assert.equal(isSelectablePresentationTemplateId("ungegoogelt-dark"), true);
  assert.equal(isSelectableAnswerFormTemplateId("minimal"), true);
  assert.equal(isSelectablePresentationTemplateId("komm-one-pubquiz"), true);
  assert.equal(isSelectableAnswerFormTemplateId("komm-one-pubquiz"), true);
});

test("Komm.ONE is an isolated presentation and answer-form pair with official local logos", () => {
  const presentation = getPresentationTemplate("komm-one-pubquiz");
  const answerForm = getAnswerFormTemplate("komm-one-pubquiz");

  assert.equal(presentation?.design.stylePreset, "KOMM_ONE");
  assert.equal(answerForm?.design.stylePreset, "KOMM_ONE");
  assert.equal(presentation?.tokens.assets.logo, "/branding/komm-one/komm-one-on-dark.svg");
  assert.equal(answerForm?.tokens.assets.logo, "/branding/komm-one/komm-one-on-light.svg");
  assert.deepEqual(
    [presentation?.tokens.colors.primary, presentation?.tokens.colors.secondary, presentation?.tokens.colors.accent, presentation?.tokens.colors.background],
    ["#00B2A9", "#008481", "#F1C400", "#003A40"],
  );
});

test("German and English labels and descriptions are complete", () => {
  for (const locale of ["de", "en"] as const) {
    const messages = loadRenderingMessages(locale);
    for (const template of [...templateRegistry.presentation, ...templateRegistry.answerForm]) {
      assert.ok(messages.templates[template.labelKey].label);
      assert.ok(messages.templates[template.labelKey].description);
    }
  }
});
