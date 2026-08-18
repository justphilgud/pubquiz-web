import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PIXEL_TEMPLATE_CONFIG } from "../pixelTemplateConfig";
import { applyQuestionTemplateToDraft } from "../questionTemplateDraft";
import type { QuestionEditorDraft, QuestionTemplate } from "../types";
import {
  buildDynamicQuestionTemplate,
  createDefaultDynamicTemplateRuleSelection,
  getDynamicTemplateRequirementIssue,
  getDynamicQuestionTemplateInitialStatus,
  parseDynamicQuestionTemplateSnapshot,
  resolveDynamicTemplateAnswerRule,
  resolveDynamicTemplateMediaRule,
  type DynamicQuestionTemplateSnapshot,
} from "./dynamicQuestionTemplate";

const baseTemplate: QuestionTemplate = {
  id: "standard", icon: "message-square", enabled: true,
  answerMode: "OPEN_TEXT", evaluationMode: "MANUAL",
  editorKind: "STANDARD", presentationKind: "STANDARD", answerFormKind: "STANDARD",
  selectable: false, availableForFiltering: true, requiresAnswerImages: false,
  name: "Standardfrage", description: "Standard", defaultQuestionText: "",
  questionLabel: "Frage", allowsOptionalQuestionImage: true,
  initialAnswers: [{ isCorrect: true }], generators: [], contentGenerators: [],
  mediaSlots: [{ key: "question_image", allowedMediaType: "IMAGE", required: false, label: "Bild", manualUploadAllowed: true, generatorInput: false, generatorOutput: false }],
};

const snapshot: DynamicQuestionTemplateSnapshot = {
  version: 1,
  questionText: { role: "FIXED", value: "Wer schrieb dieses Buch?" },
  media: [{ slotKey: "question_image", mediaType: "IMAGE", role: "REQUIRED_NEW" }],
  answers: [{ sourceKey: "answer:1", isCorrect: true, role: "REQUIRED_NEW", text: "Autor", additionalInfo: "" }],
  templateConfig: DEFAULT_PIXEL_TEMPLATE_CONFIG,
};

test("builds book and music-like templates through the same generic snapshot", () => {
  const template = buildDynamicQuestionTemplate({ id: 4, name: "Buchcover – Autor gesucht", description: null, baseTemplate, snapshot });
  assert.equal(template.id, "dynamic:4");
  assert.equal(template.selectable, true);
  assert.equal(template.baseTemplateId, null);
  assert.equal(template.defaultQuestionText, "Wer schrieb dieses Buch?");
  assert.equal(template.mediaSlots[0].required, true);
  assert.equal(template.initialQuestionMedia?.length, 0);
  assert.equal(template.initialAnswers[0].text, "");
});

test("fixed media is copied deliberately while required-new media stays empty", () => {
  const fixed = buildDynamicQuestionTemplate({
    id: 5, name: "Festes Bild", description: "", baseTemplate,
    snapshot: { ...snapshot, media: [{ ...snapshot.media[0], role: "FIXED", fixedUrl: "https://blob.test/template.jpg" }] },
  });
  assert.equal(fixed.initialQuestionMedia?.[0].url, "https://blob.test/template.jpg");
  assert.equal(fixed.initialQuestionMedia?.[0].operation, "NEW");
});

test("required-new fields are validated without a second form engine", () => {
  const draft = { questionText: snapshot.questionText.value, questionMedia: [], answers: [{ text: "", id: "a", isCorrect: true, additionalInfo: "", media: null }] };
  assert.equal(getDynamicTemplateRequirementIssue(snapshot, draft), "MEDIA");
  const withMedia = { ...draft, questionMedia: [{ slotKey: "question_image" as const, existingMediaId: null, url: "https://blob.test/new.jpg", mediaType: "IMAGE" as const, operation: "NEW" as const, existingMediaCount: 0 }] };
  assert.equal(getDynamicTemplateRequirementIssue(snapshot, withMedia), "ANSWER");
  assert.equal(getDynamicTemplateRequirementIssue(snapshot, { ...withMedia, answers: [{ ...draft.answers[0], text: "Neue Antwort" }] }), null);
});

test("defaults keep text, require fresh media and fresh correct answers", () => {
  const draft = {
    templateId: null, sourceTemplateId: null, questionText: "Frage", questionMedia: [{ slotKey: "question_image", existingMediaId: 9, url: "https://blob.test/source.jpg", mediaType: "IMAGE", operation: "UNCHANGED", existingMediaCount: 1 }],
    answers: [{ id: "answer-2", answerId: 2, text: "Lösung", isCorrect: true, additionalInfo: "", media: null }],
  } as QuestionEditorDraft;
  assert.deepEqual(createDefaultDynamicTemplateRuleSelection(draft), {
    questionText: "FIXED",
    media: [{ sourceMediaId: 9, slotKey: "question_image", role: "REQUIRED_NEW" }],
    answers: [{ sourceKey: "answer:2", role: "REQUIRED_NEW" }],
  });
});

test("persisted ids received after saving keep safe default roles", () => {
  const initialRules = createDefaultDynamicTemplateRuleSelection({
    scope: "GLOBAL",
    eventSeriesIds: [],
    templateId: null,
    sourceTemplateId: null,
    questionText: "Frage",
    questionMedia: [],
    templateConfig: DEFAULT_PIXEL_TEMPLATE_CONFIG,
    answers: [{
      id: "temporary-answer",
      text: "Lösung",
      isCorrect: true,
      additionalInfo: "",
      media: null,
    }],
    categoryIds: [],
    sourceOrRemark: "",
    moderationNotes: "",
    categoryRequest: "",
    approvalRemark: "",
    isIncomplete: true,
    validUntil: null,
    status: "DRAFT",
  });
  const savedAnswer = {
    id: "saved-answer",
    answerId: 42,
    text: "Lösung",
    isCorrect: true,
    additionalInfo: "",
    media: null,
  };
  assert.deepEqual(resolveDynamicTemplateAnswerRule(initialRules, savedAnswer), {
    sourceKey: "answer:42",
    role: "REQUIRED_NEW",
  });
  assert.deepEqual(resolveDynamicTemplateMediaRule(initialRules, {
    existingMediaId: 23,
    slotKey: "question_image",
  }), {
    sourceMediaId: 23,
    slotKey: "question_image",
    role: "REQUIRED_NEW",
  });
});

test("rejects malformed stored snapshots", () => {
  assert.equal(parseDynamicQuestionTemplateSnapshot({ version: 1 }), null);
  assert.equal(parseDynamicQuestionTemplateSnapshot({
    ...snapshot,
    media: [{ ...snapshot.media[0], slotKey: "not-a-real-slot" }],
  }), null);
  assert.equal(parseDynamicQuestionTemplateSnapshot({
    ...snapshot,
    media: [{ ...snapshot.media[0], role: "FIXED" }],
  }), null);
  assert.deepEqual(parseDynamicQuestionTemplateSnapshot(snapshot), snapshot);
});

test("editors suggest templates while admins activate them directly", () => {
  assert.equal(getDynamicQuestionTemplateInitialStatus(false), "PENDING");
  assert.equal(getDynamicQuestionTemplateInitialStatus(true), "ACTIVE");
});

test("applies a dynamic template as a normal structural editor draft", () => {
  const template = buildDynamicQuestionTemplate({ id: 12, name: "Buchcover", description: null, baseTemplate, snapshot });
  const current = {
    scope: "GLOBAL", eventSeriesIds: [], templateId: null, sourceTemplateId: null,
    questionText: "Alter Inhalt",
    questionMedia: [{ slotKey: "question_image", existingMediaId: 77, url: "https://blob.test/old.jpg", mediaType: "IMAGE", operation: "UNCHANGED", existingMediaCount: 1 }],
    templateConfig: DEFAULT_PIXEL_TEMPLATE_CONFIG,
    answers: [{ id: "old", text: "Alt", isCorrect: true, additionalInfo: "", media: null }],
    categoryIds: [], sourceOrRemark: "", moderationNotes: "", categoryRequest: "", approvalRemark: "",
    isIncomplete: true, validUntil: null, status: "DRAFT",
  } as QuestionEditorDraft;
  const applied = applyQuestionTemplateToDraft(current, template, () => "new");
  assert.equal(applied.templateId, null);
  assert.equal(applied.sourceTemplateId, 12);
  assert.equal(applied.questionText, "Wer schrieb dieses Buch?");
  assert.deepEqual(applied.questionMedia, []);
  assert.equal(applied.answers[0].text, "");
});
