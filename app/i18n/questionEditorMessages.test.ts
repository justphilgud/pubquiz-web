import assert from "node:assert/strict";
import test from "node:test";
import { resolveLocale } from "./locale";
import type { QuestionEditorMessages } from "./messageTypes";
import { loadQuestionEditorMessages } from "./questionEditorMessages";
import { formatMessage } from "./formatMessage";
import {
  formatQuestionEditorError,
  formatQuestionQualityIssue,
} from "@/app/fragen/editor/questionEditorLocalization";
import { localizeQuestionTemplates } from "@/app/fragen/editor/templates/questionTemplates";
import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { evaluateQuestionQuality } from "@/app/fragen/editor/questionQuality";

function assertCoreStructure(messages: QuestionEditorMessages) {
  assert.equal(typeof messages.editor.titles.create, "string");
  assert.equal(typeof messages.templates.faceMorph.name, "string");
  assert.equal(typeof messages.quality.QUESTION_TEXT_REQUIRED, "string");
  assert.equal(typeof messages.errors.UNKNOWN_ERROR, "string");
}

test("the complete German question-editor catalog loads", () => {
  const messages = loadQuestionEditorMessages("de");
  assertCoreStructure(messages);
  assert.equal(messages.editor.titles.create, "Neue Frage");
  assert.equal(messages.templateMedia.faceMorphLabel, "FaceMorph-Bild");
});

test("the question placeholder uses the deployment copy", () => {
  assert.equal(loadQuestionEditorMessages("de").question.placeholder, "Formuliere deine Frage...");
  assert.equal(loadQuestionEditorMessages("en").question.placeholder, "Write your question...");
});

test("the English catalog loads and falls back to German for missing details", () => {
  const messages = loadQuestionEditorMessages("en");
  assertCoreStructure(messages);
  assert.equal(messages.editor.titles.create, "New question");
  assert.equal(messages.details.expiryTitle, "Zeitlich begrenzte Frage");
});

test("an unknown locale resolves to German", () => {
  const locale = resolveLocale("fr");
  assert.equal(locale, "de");
  assert.equal(loadQuestionEditorMessages(locale).question.label, "Frage");
});

test("central quality codes resolve in German and English", () => {
  const issue = { code: "QUESTION_TEXT_REQUIRED" as const };
  assert.equal(
    formatQuestionQualityIssue(issue, loadQuestionEditorMessages("de")),
    "Fragetext fehlt",
  );
  assert.equal(
    formatQuestionQualityIssue(issue, loadQuestionEditorMessages("en")),
    "Question text is missing",
  );
});

test("quality evaluation returns structured codes instead of display text", () => {
  const result = evaluateQuestionQuality({
    templateId: null, templateConfig: { stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 } },
    questionText: "",
    questionMedia: [],
    answers: [{ id: "answer-1", text: "", isCorrect: true, additionalInfo: "", media: null }],
    categoryIds: [],
    sourceOrRemark: "",
    moderationNotes: "",
    approvalRemark: "",
    isIncomplete: true,
    validUntil: null,
    status: "DRAFT",
  });

  assert.ok(result.blockers.some((issue) => issue.code === "QUESTION_TEXT_REQUIRED"));
  assert.ok(result.blockers.some((issue) => issue.code === "CORRECT_ANSWER_REQUIRED"));
  assert.ok(result.warnings.some((issue) => issue.code === "CATEGORY_MISSING"));
});

test("message parameters such as maximum sizes are inserted", () => {
  assert.equal(
    formatMessage(loadQuestionEditorMessages("de").media.tooLarge, { size: "10 MB" }),
    "Die Datei darf höchstens 10 MB groß sein.",
  );
});

test("an unknown error code uses the controlled fallback", () => {
  assert.equal(
    formatQuestionEditorError(
      "FUTURE_ERROR",
      loadQuestionEditorMessages("en"),
      "Controlled fallback",
    ),
    "Controlled fallback",
  );
});

test("template ids stay technical while translations change", () => {
  const german = localizeQuestionTemplates(loadQuestionEditorMessages("de"));
  const english = localizeQuestionTemplates(loadQuestionEditorMessages("en"));
  const germanFaceMorph = german.find((template) => template.id === questionTemplateIds.faceMorph);
  const englishFaceMorph = english.find((template) => template.id === questionTemplateIds.faceMorph);

  assert.equal(germanFaceMorph?.id, "face_morph");
  assert.equal(englishFaceMorph?.id, "face_morph");
  assert.equal(germanFaceMorph?.defaultQuestionText, "Welche beiden Personen sind auf diesem Bild zu sehen?");
  assert.equal(englishFaceMorph?.defaultQuestionText, "Which two people can you see in this image?");
});

test("bitcrush copy does not claim 8-bit or chiptune synthesis", () => {
  const de = loadQuestionEditorMessages("de");
  const en = loadQuestionEditorMessages("en");
  const visibleCopy = [
    de.templates.musicEightBit.name, de.templates.musicEightBit.description,
    de.generators.definitions.audioBitcrush.label, de.generators.definitions.audioBitcrush.description,
    en.templates.musicEightBit.name, en.templates.musicEightBit.description,
    en.generators.definitions.audioBitcrush.label, en.generators.definitions.audioBitcrush.description,
  ].join(" ");
  assert.doesNotMatch(visibleCopy, /8-bit|8-Bit|chiptune|Game Boy|NES|SNES/);
});

test("loading another locale does not mutate existing question content", () => {
  const persistedQuestionText = "Bereits gespeicherter eigener Fragetext";
  localizeQuestionTemplates(loadQuestionEditorMessages("en"));
  assert.equal(persistedQuestionText, "Bereits gespeicherter eigener Fragetext");
});
