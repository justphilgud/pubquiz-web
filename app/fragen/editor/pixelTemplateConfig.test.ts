import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PIXEL_TEMPLATE_CONFIG,
  normalizeQuestionTemplateConfig,
  parseQuestionTemplateConfigDraft,
} from "./pixelTemplateConfig";

test("pixel stage durations default to 20 seconds and validate integer bounds", () => {
  assert.deepEqual(normalizeQuestionTemplateConfig(null), DEFAULT_PIXEL_TEMPLATE_CONFIG);
  assert.deepEqual(normalizeQuestionTemplateConfig({ stageDurationsSeconds: { stage3: 25, stage2: 15, stage1: 10 } }), {
    stageDurationsSeconds: { stage3: 25, stage2: 15, stage1: 10 },
  });
  for (const invalid of [0, -1, 121, 1.5, "20"]) {
    assert.equal(normalizeQuestionTemplateConfig({ stageDurationsSeconds: { stage3: invalid, stage2: 20, stage1: 20 } }), null);
  }
});

test("draft parsing preserves numeric invalid durations but rejects free strings", () => {
  assert.deepEqual(parseQuestionTemplateConfigDraft({
    stageDurationsSeconds: { stage3: 0, stage2: -2, stage1: 1.5 },
  }), {
    stageDurationsSeconds: { stage3: 0, stage2: -2, stage1: 1.5 },
  });
  assert.equal(parseQuestionTemplateConfigDraft({
    stageDurationsSeconds: { stage3: "20", stage2: 20, stage1: 20 },
  }), null);
});
