import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeMemeCaptionLayout,
  countMemeCaptionLines,
  isMemeCaptionPayloadReadable,
  MEME_CAPTION_MAX_LINES,
  MEME_CAPTION_MIN_FONT_CQW,
  MEME_CAPTION_PREFERRED_FONT_CQW,
} from "./memeCaptionLayout";

test("short captions stay large while empty captions need no row", () => {
  assert.deepEqual(analyzeMemeCaptionLayout(""), {
    fits: true,
    fontSizeCqw: MEME_CAPTION_PREFERRED_FONT_CQW,
    lineCount: 0,
  });
  assert.deepEqual(analyzeMemeCaptionLayout("Kurz und gut"), {
    fits: true,
    fontSizeCqw: MEME_CAPTION_PREFERRED_FONT_CQW,
    lineCount: 1,
  });
});

test("longer captions wrap and scale without crossing the minimum", () => {
  const analysis = analyzeMemeCaptionLayout(
    "Wenn der Quizmaster sagt, diese Runde wird wirklich ganz einfach und alle sofort lachen",
  );
  assert.equal(analysis.fits, true);
  assert.ok(analysis.lineCount >= 2 && analysis.lineCount <= MEME_CAPTION_MAX_LINES);
  assert.ok(analysis.fontSizeCqw < MEME_CAPTION_PREFERRED_FONT_CQW);
  assert.ok(analysis.fontSizeCqw >= MEME_CAPTION_MIN_FONT_CQW);
});

test("long individual words break deterministically and umlauts remain valid", () => {
  assert.ok(countMemeCaptionLines("Donaudampfschifffahrtsgesellschaftskapitän", 26) >= 2);
  assert.equal(
    analyzeMemeCaptionLayout("Fünf große Boxkämpfer jagen Österreich quer über Sylt").fits,
    true,
  );
});

test("text beyond the three-line minimum-size boundary is rejected", () => {
  const tooWide = "W".repeat(80);
  const analysis = analyzeMemeCaptionLayout(tooWide);
  assert.equal(analysis.fits, false);
  assert.equal(analysis.fontSizeCqw, MEME_CAPTION_MIN_FONT_CQW);
  assert.ok(analysis.lineCount > MEME_CAPTION_MAX_LINES);
  assert.equal(
    isMemeCaptionPayloadReadable({ topText: tooWide, bottomText: "kurz" }),
    false,
  );
});

test("top and bottom captions share the same readability contract", () => {
  assert.equal(
    isMemeCaptionPayloadReadable({
      topText: "Oben kurz",
      bottomText: "Unten ebenfalls lesbar",
    }),
    true,
  );
  assert.equal(
    isMemeCaptionPayloadReadable({
      topText: "Oben kurz",
      bottomText: "W".repeat(80),
    }),
    false,
  );
});
