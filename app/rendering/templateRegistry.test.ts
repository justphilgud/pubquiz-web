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
