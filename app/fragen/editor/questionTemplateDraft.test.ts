import assert from "node:assert/strict";
import test from "node:test";
import { createQuestionMediaDraftFromStoredMedia } from "./questionMedia";
import {
  analyzeQuestionTemplateChange,
  applyQuestionTemplateToDraft,
  clearQuestionTemplateFromDraft,
  getActiveQuestionMediaSlots,
} from "./questionTemplateDraft";
import { localizeQuestionTemplates } from "./templates/questionTemplates";
import { loadQuestionEditorMessages } from "@/app/i18n/questionEditorMessages";
import {
  findQuestionTemplate,
  questionTemplateIds,
} from "./templates/questionTemplateRegistry";
import type { QuestionEditorDraft, QuestionMediaDraft } from "./types";

const questionTemplates = localizeQuestionTemplates(
  loadQuestionEditorMessages("de"),
);

function createDraft(questionMedia: QuestionMediaDraft[] = []): QuestionEditorDraft {
  return {
    templateId: null, templateConfig: { stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 } },
    questionText: "Bestehende Frage",
    questionMedia,
    answers: [
      {
        id: "answer-1",
        text: "Antwort",
        isCorrect: true,
        additionalInfo: "",
        media: null,
      },
    ],
    categoryIds: [],
    sourceOrRemark: "",
    moderationNotes: "",
    approvalRemark: "",
    isIncomplete: true,
    validUntil: null,
    status: "DRAFT",
  };
}

test("a new standard question has optional image and audio slots", () => {
  const standard = findQuestionTemplate(
    questionTemplates,
    questionTemplateIds.standard,
  );

  assert.ok(standard);
  const slots = getActiveQuestionMediaSlots(standard, []);
  assert.deepEqual(slots.map((slot) => [slot.key, slot.required]), [
    ["question_image", false],
    ["question_audio", false],
  ]);
});

test("a stored standard-question image is loaded into a controlled optional slot", () => {
  const media = createQuestionMediaDraftFromStoredMedia([
    {
      medien_id: 42,
      datei: "https://example.public.blob.vercel-storage.com/dev/question-media/image/example.jpg",
      medientyp: { medientyp: "Bild" },
    },
  ]);
  const slot = getActiveQuestionMediaSlots(null, media)[0];

  assert.ok(media);
  assert.equal(media[0].operation, "UNCHANGED");
  assert.equal(media[0].existingMediaId, 42);
  assert.ok(slot);
  assert.equal(slot.required, false);
  assert.equal(slot.allowedMediaType, "IMAGE");
});

test("applying a template preserves existing question media unchanged", () => {
  const media = createQuestionMediaDraftFromStoredMedia([
    {
      medien_id: 42,
      datei: "legacy/image.jpg",
      medientyp: { medientyp: "Bild" },
    },
  ]);
  const draft = createDraft(media);
  const faceMorph = findQuestionTemplate(
    questionTemplates,
    questionTemplateIds.faceMorph,
  );

  assert.ok(faceMorph);
  const changedDraft = applyQuestionTemplateToDraft(
    draft,
    faceMorph,
    () => "generated-id",
  );

  assert.strictEqual(changedDraft.questionMedia, media);
  assert.equal(changedDraft.questionMedia[0].operation, "UNCHANGED");
});

test("clearing a template preserves existing question media unchanged", () => {
  const media = createQuestionMediaDraftFromStoredMedia([
    {
      medien_id: 42,
      datei: "legacy/image.jpg",
      medientyp: { medientyp: "Bild" },
    },
  ]);
  const draft = {
    ...createDraft(media),
    templateId: questionTemplateIds.faceMorph,
  };
  const changedDraft = clearQuestionTemplateFromDraft(draft);

  assert.equal(changedDraft.templateId, null);
  assert.strictEqual(changedDraft.questionMedia, media);
  assert.equal(changedDraft.questionMedia[0].operation, "UNCHANGED");
});

test("template switches preserve pixel stage durations", () => {
  const original = createDraft([]);
  original.templateConfig = { stageDurationsSeconds: { stage3: 25, stage2: 15, stage1: 10 } };
  const changed = applyQuestionTemplateToDraft(original, questionTemplates[0], () => "new-answer");
  assert.deepEqual(changed.templateConfig, original.templateConfig);
  assert.deepEqual(clearQuestionTemplateFromDraft(changed).templateConfig, original.templateConfig);
});

test("a template switch reports an incompatible retained required medium", () => {
  const audioMedia: QuestionMediaDraft = {
    slotKey: "music_reverse_audio",
    existingMediaId: 7,
    url: "legacy/audio.mp3",
    mediaType: "AUDIO",
    operation: "UNCHANGED",
    existingMediaCount: 1,
  };
  const faceMorph = findQuestionTemplate(
    questionTemplates,
    questionTemplateIds.faceMorph,
  );

  assert.ok(faceMorph);
  assert.deepEqual(analyzeQuestionTemplateChange(createDraft([audioMedia]), faceMorph), {
    overwritesContent: true,
    retainsQuestionMedia: true,
    hasRequiredMediaTypeConflict: true,
  });
});
