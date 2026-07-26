import assert from "node:assert/strict";
import test from "node:test";

import {
  MODERATION_PREVIEW_LOGICAL_HEIGHT,
  MODERATION_PREVIEW_LOGICAL_WIDTH,
  MODERATION_PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO,
  resolveModerationPreviewLayout,
} from "./[quizId]/moderation/moderationPreviewLayout";

const NOTEBOOK_AND_DESKTOP_CASES = [
  { viewport: "1920×1080", availableWidth: 1512, viewportHeight: 1080 },
  { viewport: "1366×768", availableWidth: 958, viewportHeight: 768 },
  { viewport: "1440×900", availableWidth: 1032, viewportHeight: 900 },
];

for (const testCase of NOTEBOOK_AND_DESKTOP_CASES) {
  test(`${testCase.viewport} keeps the complete preview within 48vh`, () => {
    const layout = resolveModerationPreviewLayout(
      testCase.availableWidth,
      testCase.viewportHeight,
    );

    assert.ok(layout.width <= testCase.availableWidth);
    assert.ok(
      layout.height <=
        testCase.viewportHeight *
          MODERATION_PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO,
    );
    assert.equal(
      layout.width / layout.height,
      MODERATION_PREVIEW_LOGICAL_WIDTH /
        MODERATION_PREVIEW_LOGICAL_HEIGHT,
    );
    assert.equal(
      layout.scale,
      layout.width / MODERATION_PREVIEW_LOGICAL_WIDTH,
    );
  });
}

test("a narrow column remains width-limited without changing 16:9", () => {
  const layout = resolveModerationPreviewLayout(480, 1080);

  assert.equal(layout.width, 480);
  assert.equal(
    layout.height,
    480 *
      (MODERATION_PREVIEW_LOGICAL_HEIGHT /
        MODERATION_PREVIEW_LOGICAL_WIDTH),
  );
});

test("invalid measurements resolve to an empty safe layout", () => {
  assert.deepEqual(resolveModerationPreviewLayout(-1, -1), {
    width: 0,
    height: 0,
    scale: 0,
  });
});
