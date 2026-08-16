import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PIXEL_TEMPLATE_CONFIG,
  NEW_FACE_MORPH_PIXEL_QUESTION_OPTIONS,
  getFaceMorphPixelQuestionOptionsForTemplate,
  normalizeQuestionTemplateConfig,
  parseQuestionTemplateConfigDraft,
  updateFaceMorphPixelQuestionOption,
  withFaceMorphPixelQuestionOptions,
  withoutFaceMorphPixelQuestionOptions,
} from "./pixelTemplateConfig";
import { questionTemplateIds } from "./templates/questionTemplateRegistry";

test("pixel stage durations default to 15 seconds and validate integer bounds", () => {
  assert.deepEqual(normalizeQuestionTemplateConfig(null), DEFAULT_PIXEL_TEMPLATE_CONFIG);
  assert.deepEqual(normalizeQuestionTemplateConfig({ stageDurationsSeconds: { stage3: 25, stage2: 15, stage1: 10 } }), {
    stageDurationsSeconds: { stage3: 25, stage2: 15, stage1: 10 },
    createPixelQuestionByAnswer: { answer1: false, answer2: false },
  });
  for (const invalid of [0, -1, 121, 1.5, "20"]) {
    assert.equal(normalizeQuestionTemplateConfig({ stageDurationsSeconds: { stage3: invalid, stage2: 20, stage1: 20 } }), null);
  }
});

test("FaceMorph pixel options load with safe defaults and boolean validation", () => {
  assert.deepEqual(NEW_FACE_MORPH_PIXEL_QUESTION_OPTIONS, {
    answer1: true,
    answer2: true,
  });
  assert.deepEqual(
    normalizeQuestionTemplateConfig(null, questionTemplateIds.faceMorph),
    DEFAULT_PIXEL_TEMPLATE_CONFIG,
  );
  assert.deepEqual(
    normalizeQuestionTemplateConfig({}, questionTemplateIds.faceMorph),
    DEFAULT_PIXEL_TEMPLATE_CONFIG,
  );
  assert.deepEqual(
    normalizeQuestionTemplateConfig(
      {
        createPixelQuestionByAnswer: { answer1: true, answer2: false },
      },
      questionTemplateIds.faceMorph,
    )?.createPixelQuestionByAnswer,
    { answer1: true, answer2: false },
  );
  assert.equal(
    normalizeQuestionTemplateConfig(
      {
        createPixelQuestionByAnswer: { answer1: "true", answer2: false },
      },
      questionTemplateIds.faceMorph,
    ),
    null,
  );
});

test("active FaceMorph pixel options are rejected for other templates", () => {
  const activeConfig = updateFaceMorphPixelQuestionOption(
    DEFAULT_PIXEL_TEMPLATE_CONFIG,
    "answer2",
    true,
  );

  assert.equal(
    normalizeQuestionTemplateConfig(activeConfig, questionTemplateIds.pixelImage),
    null,
  );
  assert.equal(
    getFaceMorphPixelQuestionOptionsForTemplate(
      activeConfig,
      questionTemplateIds.pixelImage,
    ),
    undefined,
  );
  assert.deepEqual(
    getFaceMorphPixelQuestionOptionsForTemplate(
      activeConfig,
      questionTemplateIds.faceMorph,
    ),
    { answer1: false, answer2: true },
  );
  assert.deepEqual(
    withoutFaceMorphPixelQuestionOptions(activeConfig)
      .createPixelQuestionByAnswer,
    { answer1: false, answer2: false },
  );
  assert.deepEqual(
    withFaceMorphPixelQuestionOptions(
      withoutFaceMorphPixelQuestionOptions(activeConfig),
      activeConfig.createPixelQuestionByAnswer,
    ).createPixelQuestionByAnswer,
    { answer1: false, answer2: true },
  );
});

test("draft parsing preserves numeric invalid durations but rejects free strings", () => {
  assert.deepEqual(parseQuestionTemplateConfigDraft({
    stageDurationsSeconds: { stage3: 0, stage2: -2, stage1: 1.5 },
  }), {
    stageDurationsSeconds: { stage3: 0, stage2: -2, stage1: 1.5 },
    createPixelQuestionByAnswer: { answer1: false, answer2: false },
  });
  assert.equal(parseQuestionTemplateConfigDraft({
    stageDurationsSeconds: { stage3: "20", stage2: 20, stage1: 20 },
  }), null);
});
