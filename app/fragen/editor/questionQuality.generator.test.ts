import assert from "node:assert/strict";
import test from "node:test";
import { evaluateQuestionQuality } from "./questionQuality";
import type { QuestionEditorDraft, QuestionMediaDraft } from "./types";

function media(slotKey: QuestionMediaDraft["slotKey"], id: number): QuestionMediaDraft {
  const mediaType = slotKey.startsWith("pixel_") ? "IMAGE" : "AUDIO";
  return { slotKey, existingMediaId: id, url: `https://blob/${id}`, mediaType, operation: "UNCHANGED", existingMediaCount: 1 };
}
function draft(questionMedia: QuestionMediaDraft[]): QuestionEditorDraft {
  return {
    templateId: "musik_rueckwaerts", questionText: "Song?", questionMedia,
    generatorRuns: [], templateConfig: { stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 }, createPixelQuestionByAnswer: { answer1: false, answer2: false } }, answers: [{ id: "a", text: "Titel", isCorrect: true, additionalInfo: "", media: null }],
    categoryIds: [1], sourceOrRemark: "Quelle", moderationNotes: "", categoryRequest: "", approvalRemark: "", isIncomplete: false, validUntil: null, status: "READY",
  };
}

test("legacy reverse-only questions remain non-blocking and are labelled", () => {
  const result = evaluateQuestionQuality(draft([media("music_reverse_audio", 2)]));
  assert.equal(result.blockers.some((issue) => issue.code.startsWith("GENERATOR_")), false);
  assert.equal(result.warnings.some((issue) => issue.code === "GENERATOR_LEGACY_OUTPUT"), true);
});

test("pixel output becomes stale when the persisted preset differs", () => {
  const current = draft([
    media("pixel_original_image", 3), media("pixel_stage_3_image", 4),
    media("pixel_stage_2_image", 5), media("pixel_stage_1_image", 6),
  ]);
  current.templateId = "pixelbild";
  current.generatorParameters = { image_pixelate: { stagePreset: "three_stage_default_v1" } };
  current.generatorRuns = [{
    id: 8,
    generatorId: "image_pixelate",
    generatorVersion: 2,
    status: "SUCCEEDED",
    inputFingerprint: "pixel",
    errorCode: null,
    parameters: {},
    inputMediaIds: [3],
    outputMediaIds: [4, 5, 6],
  }];
  assert.equal(evaluateQuestionQuality(current).blockers.some((issue) => issue.code === "GENERATOR_OUTPUT_STALE"), true);
});

test("a complete three-stage pixel run is current while a version-one result stays legacy", () => {
  const stageMedia = [
    media("pixel_original_image", 3), media("pixel_stage_3_image", 4),
    media("pixel_stage_2_image", 5), media("pixel_stage_1_image", 6),
  ];
  const current = draft(stageMedia);
  current.templateId = "pixelbild";
  current.generatorParameters = { image_pixelate: { stagePreset: "three_stage_default_v1" } };
  current.generatorRuns = [{
    id: 9, generatorId: "image_pixelate", generatorVersion: 2, status: "SUCCEEDED",
    inputFingerprint: "pixel-v2", errorCode: null, parameters: { stagePreset: "three_stage_default_v1" },
    inputMediaIds: [3], outputMediaIds: [4, 5, 6],
  }];
  assert.equal(evaluateQuestionQuality(current).blockers.some((issue) => issue.code.startsWith("GENERATOR_")), false);

  const legacy = draft([media("pixel_original_image", 3), media("pixel_result_image", 7)]);
  legacy.templateId = "pixelbild";
  legacy.generatorRuns = [{
    id: 7, generatorId: "image_pixelate", generatorVersion: 1, status: "SUCCEEDED",
    inputFingerprint: "pixel-v1", errorCode: null, parameters: {}, inputMediaIds: [3], outputMediaIds: [7],
  }];
  const legacyQuality = evaluateQuestionQuality(legacy);
  assert.equal(legacyQuality.blockers.some((issue) => issue.code.startsWith("GENERATOR_")), false);
  assert.equal(legacyQuality.warnings.some((issue) => issue.code === "GENERATOR_LEGACY_OUTPUT"), true);
});

test("pixel stage durations block completion outside the allowed integer range", () => {
  const current = draft([]);
  current.templateId = "pixelbild";
  current.templateConfig = { stageDurationsSeconds: { stage3: 0, stage2: 20, stage1: 20 }, createPixelQuestionByAnswer: { answer1: false, answer2: false } };
  assert.equal(evaluateQuestionQuality(current).blockers.some((issue) => issue.code === "PIXEL_STAGE_DURATIONS_INVALID"), true);
});

test("new reverse questions require a current successful output", () => {
  const current = draft([media("music_original_audio", 1), media("music_reverse_audio", 2)]);
  current.generatorRuns = [{ id: 7, generatorId: "audio_reverse", generatorVersion: 1, status: "SUCCEEDED", inputFingerprint: "a", errorCode: null, parameters: {}, inputMediaIds: [1], outputMediaIds: [2] }];
  assert.equal(evaluateQuestionQuality(current).blockers.some((issue) => issue.code.startsWith("GENERATOR_")), false);
  current.generatorRuns![0].status = "STALE";
  assert.equal(evaluateQuestionQuality(current).blockers.some((issue) => issue.code === "GENERATOR_OUTPUT_STALE"), true);
});
