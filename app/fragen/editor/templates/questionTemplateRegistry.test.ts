import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { localizeQuestionTemplates } from "./questionTemplates";
import { loadQuestionEditorMessages } from "@/app/i18n/questionEditorMessages";
import {
  findQuestionTemplate,
  getQuestionTemplatePersistenceIds,
  questionTemplateIds,
  representsSameQuestionTemplate,
  resolveCanonicalQuestionTemplateId,
} from "./questionTemplateRegistry";

const editorActions = readFileSync(
  new URL("../actions.ts", import.meta.url),
  "utf8",
);

const questionTemplates = localizeQuestionTemplates(
  loadQuestionEditorMessages("de"),
);

test("legacy template aliases resolve to canonical database codes", () => {
  assert.equal(
    resolveCanonicalQuestionTemplateId("facemorph"),
    questionTemplateIds.faceMorph,
  );
  assert.equal(
    resolveCanonicalQuestionTemplateId("music-reverse"),
    questionTemplateIds.musicReverse,
  );
  assert.equal(
    resolveCanonicalQuestionTemplateId("multiple-choice"),
    questionTemplateIds.multipleChoice,
  );
  assert.equal(resolveCanonicalQuestionTemplateId("music-8bit"), questionTemplateIds.musicEightBit);
  assert.equal(resolveCanonicalQuestionTemplateId("image_pixel"), questionTemplateIds.pixelImage);
});

test("read normalization identifies unchanged legacy IDs without migrating them", () => {
  assert.equal(
    representsSameQuestionTemplate("multiple-choice", "multiple_choice"),
    true,
  );
  assert.equal(representsSameQuestionTemplate("image_pixel", "pixelbild"), true);
  assert.equal(representsSameQuestionTemplate("standard", null), true);
  assert.equal(
    representsSameQuestionTemplate("multiple-choice", "pixelbild"),
    false,
  );
});

test("saving an unchanged legacy template preserves its persisted identity", () => {
  assert.match(
    editorActions,
    /representsSameQuestionTemplate\(\s*existingQuestion\.vorlage\.code,\s*draft\.templateId,\s*\)/,
  );
  assert.match(
    editorActions,
    /vorlage_id: persistedTemplateForUpdate\?\.vorlage_id \?\? null/,
  );
});

test("bitcrush and pixel templates expose separate generator input and output slots", () => {
  const eightBit = findQuestionTemplate(questionTemplates, questionTemplateIds.musicEightBit);
  const pixel = findQuestionTemplate(questionTemplates, questionTemplateIds.pixelImage);
  assert.deepEqual(eightBit?.mediaSlots.map((slot) => slot.key), ["music_original_audio", "music_bitcrush_audio"]);
  assert.deepEqual(pixel?.mediaSlots.map((slot) => slot.key), [
    "pixel_original_image", "pixel_stage_3_image", "pixel_stage_2_image", "pixel_stage_1_image",
  ]);
});

test("a new pixel question uses the selectable canonical registry entry", () => {
  const pixel = findQuestionTemplate(
    questionTemplates,
    questionTemplateIds.pixelImage,
  );

  assert.ok(pixel);
  assert.equal(pixel.id, "pixelbild");
  assert.equal(pixel.selectable, true);
  assert.deepEqual(pixel.generators, ["image_pixelate"]);
});

test("stored pixel aliases resolve to the canonical readable template", () => {
  const storedTemplateId = resolveCanonicalQuestionTemplateId("image_pixel");
  const pixel = findQuestionTemplate(questionTemplates, storedTemplateId);

  assert.equal(storedTemplateId, questionTemplateIds.pixelImage);
  assert.equal(pixel?.id, questionTemplateIds.pixelImage);
  assert.deepEqual(
    getQuestionTemplatePersistenceIds(questionTemplateIds.pixelImage),
    [questionTemplateIds.pixelImage, "image_pixel"],
  );
});

test("an unknown template id is handled as missing configuration", () => {
  assert.equal(findQuestionTemplate(questionTemplates, "unknown_template"), null);
});

test("bitcrush remains readable but is not productively selectable", () => {
  const eightBit = findQuestionTemplate(
    questionTemplates,
    questionTemplateIds.musicEightBit,
  );
  assert.ok(eightBit);
  assert.equal(eightBit.selectable, false);
  assert.equal(
    questionTemplates.filter((template) => template.selectable)
      .some((template) => template.id === questionTemplateIds.musicEightBit),
    false,
  );
});

test("canonical template ids remain stable and standard maps to no persisted template", () => {
  assert.equal(
    resolveCanonicalQuestionTemplateId(questionTemplateIds.faceMorph),
    questionTemplateIds.faceMorph,
  );
  assert.equal(resolveCanonicalQuestionTemplateId("standard"), null);
  assert.equal(resolveCanonicalQuestionTemplateId(null), null);
});

test("standard exposes optional general question image and audio slots", () => {
  const standard = findQuestionTemplate(
    questionTemplates,
    questionTemplateIds.standard,
  );

  assert.ok(standard);
  assert.equal(standard.allowsOptionalQuestionImage, true);
  assert.deepEqual(standard.mediaSlots.map((slot) => [slot.key, slot.required]), [
    ["question_image", false],
    ["question_audio", false],
  ]);
});

test("required template media stays distinct from general optional media", () => {
  const faceMorph = findQuestionTemplate(
    questionTemplates,
    questionTemplateIds.faceMorph,
  );

  assert.ok(faceMorph?.mediaSlots[0]);
  assert.equal(faceMorph.allowsOptionalQuestionImage, false);
  assert.equal(faceMorph.mediaSlots[0].key, "face_morph_result");
  assert.equal(faceMorph.mediaSlots[0].required, true);
  assert.equal(faceMorph.mediaSlots[0].allowedMediaType, "IMAGE");
});
