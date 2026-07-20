import assert from "node:assert/strict";
import test from "node:test";
import {
  hasExactlyOneMediaOwner,
  inferLegacyQuestionSlot,
  isMediaSlotKey,
  mediaSlotDefinitions,
} from "./mediaSlots";
import {
  buildQuestionMediaPathname,
  createQuestionMediaDraftFromStoredMedia,
  isAllowedQuestionMediaPathname,
} from "./questionMedia";
import { evaluateQuestionQuality } from "./questionQuality";
import type { QuestionEditorDraft } from "./types";

test("the semantic slot registry contains all package 3A slot ids", () => {
  assert.deepEqual(Object.keys(mediaSlotDefinitions).sort(), [
    "answer_image", "face_morph_person_a_original", "face_morph_person_b_original",
    "face_morph_result", "lyrics_tts_audio", "music_bitcrush_audio",
    "music_original_audio", "music_reverse_audio", "pixel_original_image", "pixel_result_image",
    "pixel_stage_1_image", "pixel_stage_2_image", "pixel_stage_3_image",
    "question_audio", "question_image", "question_video",
  ]);
});

test("unknown slot ids are rejected", () => {
  assert.equal(isMediaSlotKey("question_image"), true);
  assert.equal(isMediaSlotKey("freely_claimed_slot"), false);
});

test("legacy question media is assigned only to a compatible primary slot", () => {
  assert.equal(inferLegacyQuestionSlot("face_morph", "IMAGE"), "face_morph_result");
  assert.equal(inferLegacyQuestionSlot("musik_rueckwaerts", "AUDIO"), "music_reverse_audio");
  assert.equal(inferLegacyQuestionSlot("eight_bit", "AUDIO"), "music_bitcrush_audio");
  assert.equal(inferLegacyQuestionSlot("pixelbild", "IMAGE"), "pixel_result_image");
  assert.equal(inferLegacyQuestionSlot(null, "IMAGE"), "question_image");
  assert.equal(inferLegacyQuestionSlot("face_morph", "AUDIO"), null);
});

test("multiple distinct slots load independently while duplicates are blocked", () => {
  const distinct = createQuestionMediaDraftFromStoredMedia([
    { medien_id: 1, datei: "a.jpg", slot_key: "face_morph_result", medientyp: { medientyp: "Bild" } },
    { medien_id: 2, datei: "b.jpg", slot_key: "face_morph_person_a_original", medientyp: { medientyp: "Bild" } },
  ], "face_morph");
  assert.equal(distinct.length, 2);
  assert.equal(distinct.every((media) => !media.blockedReasonCode), true);

  const duplicate = createQuestionMediaDraftFromStoredMedia([
    { medien_id: 1, datei: "a.jpg", slot_key: "question_image", medientyp: { medientyp: "Bild" } },
    { medien_id: 2, datei: "b.jpg", slot_key: "question_image", medientyp: { medientyp: "Bild" } },
  ], "standard");
  assert.equal(duplicate.every((media) => media.blockedReasonCode === "MULTIPLE_QUESTION_MEDIA"), true);
});

test("upload paths bind environment, scope, slot and media type", () => {
  const pathname = buildQuestionMediaPathname("preview", "QUESTION", "IMAGE", "question_image", "id-photo.jpg");
  assert.equal(pathname, "preview/question-media/question_image/image/id-photo.jpg");
  assert.equal(isAllowedQuestionMediaPathname(pathname, "IMAGE", "QUESTION", "preview", "question_image"), true);
  assert.equal(isAllowedQuestionMediaPathname(pathname, "IMAGE", "QUESTION", "prod", "question_image"), false);
  assert.equal(isAllowedQuestionMediaPathname(pathname, "IMAGE", "QUESTION", "preview", "face_morph_result"), false);
});

test("media ownership requires exactly one parent", () => {
  assert.equal(hasExactlyOneMediaOwner({ questionId: 1 }), true);
  assert.equal(hasExactlyOneMediaOwner({ answerId: 2 }), true);
  assert.equal(hasExactlyOneMediaOwner({}), false);
  assert.equal(hasExactlyOneMediaOwner({ questionId: 1, answerId: 2 }), false);
});

test("optional standard media does not block while required template media does", () => {
  const base: QuestionEditorDraft = {
    scope: "GLOBAL", eventSeriesIds: [], templateId: null, templateConfig: { stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 }, createPixelQuestionByAnswer: { answer1: false, answer2: false } },
    questionText: "Frage",
    questionMedia: [],
    answers: [{ id: "a", text: "Antwort", isCorrect: true, additionalInfo: "", media: null }],
    categoryIds: [1], sourceOrRemark: "Quelle", moderationNotes: "", categoryRequest: "", approvalRemark: "",
    isIncomplete: false, validUntil: null, status: "READY",
  };
  assert.equal(evaluateQuestionQuality(base).blockers.some((issue) => issue.field === "questionMedia"), false);
  const faceMorph = evaluateQuestionQuality({ ...base, templateId: "face_morph" });
  assert.equal(faceMorph.blockers.some((issue) => issue.code === "MEDIA_SLOT_REQUIRED"), true);
});

test("whitespace-only question text is rejected by the central quality check", () => {
  const draft: QuestionEditorDraft = {
    scope: "GLOBAL", eventSeriesIds: [], templateId: null,
    templateConfig: { stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 }, createPixelQuestionByAnswer: { answer1: false, answer2: false } },
    questionText: "   ",
    questionMedia: [],
    answers: [{ id: "a", text: "Antwort", isCorrect: true, additionalInfo: "", media: null }],
    categoryIds: [],
    sourceOrRemark: "",
    moderationNotes: "",
    categoryRequest: "",
    approvalRemark: "",
    isIncomplete: false,
    validUntil: null,
    status: "READY",
  };
  assert.equal(
    evaluateQuestionQuality(draft).blockers.some((issue) => issue.code === "QUESTION_TEXT_REQUIRED"),
    true,
  );
});

test("an empty correct-answer card is not accepted as a correct solution", () => {
  const draft: QuestionEditorDraft = {
    scope: "GLOBAL", eventSeriesIds: [], templateId: null,
    templateConfig: { stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 }, createPixelQuestionByAnswer: { answer1: false, answer2: false } },
    questionText: "Frage",
    questionMedia: [],
    answers: [{ id: "a", text: "", isCorrect: true, additionalInfo: "", media: null }],
    categoryIds: [],
    sourceOrRemark: "",
    moderationNotes: "",
    categoryRequest: "",
    approvalRemark: "",
    isIncomplete: false,
    validUntil: null,
    status: "READY",
  };
  assert.equal(
    evaluateQuestionQuality(draft).blockers.some((issue) => issue.code === "CORRECT_ANSWER_REQUIRED"),
    true,
  );
});

test("FaceMorph requires its result and both answer images", () => {
  const image = (id: number) => ({
    slotKey: "answer_image" as const,
    existingMediaId: id,
    url: `answer-${id}.jpg`,
    mediaType: "IMAGE" as const,
    operation: "UNCHANGED" as const,
    existingMediaCount: 1,
  });
  const draft: QuestionEditorDraft = {
    scope: "GLOBAL", eventSeriesIds: [], templateId: "face_morph",
    templateConfig: { stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 }, createPixelQuestionByAnswer: { answer1: false, answer2: false } },
    questionText: "Wer ist zu sehen?",
    questionMedia: [{
      slotKey: "face_morph_result",
      existingMediaId: 3,
      url: "result.jpg",
      mediaType: "IMAGE",
      operation: "UNCHANGED",
      existingMediaCount: 1,
    }],
    answers: [
      { id: "a", fieldGroupId: "a", fieldLabel: "Person A", text: "A", isCorrect: true, additionalInfo: "", media: image(1) },
      { id: "b", fieldGroupId: "b", fieldLabel: "Person B", text: "B", isCorrect: true, additionalInfo: "", media: null },
    ],
    categoryIds: [], sourceOrRemark: "", moderationNotes: "", categoryRequest: "", approvalRemark: "",
    isIncomplete: false, validUntil: null, status: "READY",
  };

  assert.equal(
    evaluateQuestionQuality(draft).blockers.some((issue) => issue.code === "ANSWER_MEDIA_REQUIRED"),
    true,
  );
  draft.answers[1].media = image(2);
  assert.equal(
    evaluateQuestionQuality(draft).blockers.some((issue) => issue.code === "ANSWER_MEDIA_REQUIRED"),
    false,
  );
  draft.questionMedia = [];
  assert.equal(
    evaluateQuestionQuality(draft).blockers.some((issue) => issue.code === "MEDIA_SLOT_REQUIRED"),
    true,
  );
});
