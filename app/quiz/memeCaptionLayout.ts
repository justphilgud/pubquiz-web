export const MEME_CAPTION_MAX_LINES = 3;
export const MEME_CAPTION_MIN_FONT_CQW = 4.5;
export const MEME_CAPTION_PREFERRED_FONT_CQW = 7.5;
export const MEME_CAPTION_FONT_STEP_CQW = 0.25;
export const MEME_CAPTION_TOO_LONG_MESSAGE =
  "Dein Text ist zu lang. Kürze ihn, damit er im Meme gut lesbar bleibt.";

const LINE_CAPACITY_AT_MIN_FONT = 26;
const CAPTION_ROW_HEIGHT_CQW = 15.75;
const CAPTION_VERTICAL_PADDING_CQW = 1.5;
const CAPTION_LINE_HEIGHT = 1.02;

export type MemeCaptionLayoutAnalysis = {
  fits: boolean;
  fontSizeCqw: number;
  lineCount: number;
};

function glyphWidth(character: string) {
  if (/\s/u.test(character)) return 0.35;
  if (/[ilI1|!.,:;'`]/u.test(character)) return 0.42;
  if (/[MW@%&ÄÖÜ]/u.test(character)) return 1.25;
  if (/[A-Z0-9]/u.test(character)) return 0.9;
  return 0.72;
}

function textWidth(text: string) {
  return Array.from(text).reduce((sum, character) => sum + glyphWidth(character), 0);
}

export function countMemeCaptionLines(text: string, lineCapacity: number) {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return 0;

  let lineCount = 1;
  let currentLineWidth = 0;
  const spaceWidth = glyphWidth(" ");

  for (const word of words) {
    let remainingWordWidth = textWidth(word);
    const separatorWidth = currentLineWidth > 0 ? spaceWidth : 0;

    if (remainingWordWidth + separatorWidth <= lineCapacity - currentLineWidth) {
      currentLineWidth += separatorWidth + remainingWordWidth;
      continue;
    }

    if (currentLineWidth > 0) {
      lineCount += 1;
      currentLineWidth = 0;
    }

    while (remainingWordWidth > lineCapacity) {
      lineCount += 1;
      remainingWordWidth -= lineCapacity;
    }
    currentLineWidth = remainingWordWidth;
  }

  return lineCount;
}

function lineCapacity(fontSizeCqw: number) {
  return LINE_CAPACITY_AT_MIN_FONT *
    (MEME_CAPTION_MIN_FONT_CQW / fontSizeCqw);
}

function verticalLineCapacity(fontSizeCqw: number) {
  return Math.min(
    MEME_CAPTION_MAX_LINES,
    Math.floor(
      (CAPTION_ROW_HEIGHT_CQW - CAPTION_VERTICAL_PADDING_CQW) /
      (fontSizeCqw * CAPTION_LINE_HEIGHT),
    ),
  );
}

export function analyzeMemeCaptionLayout(
  text: string,
): MemeCaptionLayoutAnalysis {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      fits: true,
      fontSizeCqw: MEME_CAPTION_PREFERRED_FONT_CQW,
      lineCount: 0,
    };
  }

  for (
    let fontSize = MEME_CAPTION_PREFERRED_FONT_CQW;
    fontSize >= MEME_CAPTION_MIN_FONT_CQW;
    fontSize -= MEME_CAPTION_FONT_STEP_CQW
  ) {
    const lineCount = countMemeCaptionLines(trimmed, lineCapacity(fontSize));
    if (lineCount <= verticalLineCapacity(fontSize)) {
      return { fits: true, fontSizeCqw: fontSize, lineCount };
    }
  }

  return {
    fits: false,
    fontSizeCqw: MEME_CAPTION_MIN_FONT_CQW,
    lineCount: countMemeCaptionLines(
      trimmed,
      lineCapacity(MEME_CAPTION_MIN_FONT_CQW),
    ),
  };
}

export function isMemeCaptionPayloadReadable(payload: {
  topText: string;
  bottomText: string;
}) {
  return analyzeMemeCaptionLayout(payload.topText).fits &&
    analyzeMemeCaptionLayout(payload.bottomText).fits;
}
