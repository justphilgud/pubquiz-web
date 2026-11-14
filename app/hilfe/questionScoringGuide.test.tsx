import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { questionScoringRules, getQuestionScoringRule, getTemplateScoringHint } from "@/app/fragen/editor/templates/questionScoringGuide";
import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { localizeQuestionTemplates } from "@/app/fragen/editor/templates/questionTemplates";
import { buildDynamicQuestionTemplate, parseDynamicQuestionTemplateSnapshot } from "@/app/fragen/editor/templates/dynamicQuestionTemplate";
import { loadQuestionEditorMessages } from "@/app/i18n/questionEditorMessages";
import { TemplateSelector } from "@/app/fragen/editor/components/TemplateSelector";
import { QuestionEditorMessagesProvider } from "@/app/fragen/editor/components/QuestionEditorMessagesProvider";
import { QuestionScoringOverview } from "./QuestionScoringOverview";
import { getVisibleHelpTopics } from "./helpContent";

test("every canonical template appears in the rendered points overview", () => {
  assert.deepEqual(Object.keys(questionScoringRules).sort(), Object.values(questionTemplateIds).sort());
  const html = renderToStaticMarkup(<QuestionScoringOverview />);
  for (const id of Object.values(questionTemplateIds)) assert.ok(html.includes(`id="punkte-${id}"`));
  assert.match(html, /Richtiger Songtitel: 1 Punkt/);
  assert.match(html, /jedes Gewinnerteam 1 Punkt/);
  assert.match(html, /0,25 Punkte je richtigem Paar/);
});

test("aliases, unknown templates and dynamic standard bases have accurate hints", () => {
  assert.equal(getQuestionScoringRule("musik_8bit"), questionScoringRules.eight_bit);
  assert.equal(getQuestionScoringRule("unknown"), null);
  assert.match(getTemplateScoringHint(null), /Richtige Antwort: 1 Punkt/);
  const base = localizeQuestionTemplates(loadQuestionEditorMessages("de"))[0];
  assert.match(getTemplateScoringHint({ ...base, id: "custom_8bit", baseTemplateId: "eight_bit" }), /Richtiger Songtitel: 1 Punkt/);
  assert.match(getTemplateScoringHint({ ...base, id: "custom_standard", baseTemplateId: null }), /strukturierten Antwortfeldern/);
});

test("editors, scoped editors and event managers can open the central overview", () => {
  for (const [role, scopeType, eventSeriesId] of [["ADMIN", "GLOBAL", null], ["EDITOR", "GLOBAL", null], ["EDITOR", "EVENT_SERIES", 7], ["EVENT_MANAGER", "EVENT_SERIES", 7]] as const) {
    assert.ok(getVisibleHelpTopics({ userId: 1, assignments: [{ role, scopeType, eventSeriesId }] }).some(t => t.slug === "punkte"));
  }
});


test("the selected template shows its rule and opens help without losing the draft", () => {
  const messages = loadQuestionEditorMessages("de");
  const templates = localizeQuestionTemplates(messages);
  const music = templates.find(t => t.id === "musik")!;
  const snapshot = parseDynamicQuestionTemplateSnapshot({
    version: 1, scoringTemplateId: "eight_bit", questionText: { role: "FIXED", value: "Welcher Song?" },
    media: [], answers: [], templateConfig: {},
  })!;
  const selected = buildDynamicQuestionTemplate({ id: 24, name: "8bit", description: null, baseTemplate: music, snapshot });
  assert.equal(selected.baseTemplateId, "musik");
  assert.deepEqual(selected.mediaSlots, music.mediaSlots);
  assert.match(getTemplateScoringHint(music), /0,5 Punkte pro richtigem Antwortfeld/);
  const html = renderToStaticMarkup(<QuestionEditorMessagesProvider locale="de" messages={messages}>
    <TemplateSelector templates={templates} selectedTemplate={selected} selectedTemplateId={selected.id}
      onSelectTemplate={() => true} onClearSelection={() => undefined} />
  </QuestionEditorMessagesProvider>);
  assert.match(html, /Richtiger Songtitel: 1 Punkt/);
  assert.match(html, /href="\/hilfe\?topic=punkte"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /neuer Tab/);
});
