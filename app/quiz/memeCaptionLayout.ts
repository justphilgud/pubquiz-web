import {
  resolveMemeCaptionLayout,
  type MemeCaptionZone,
  type ResolvedMemeCaptionLayout,
} from "@/app/quiz/memeCaptionZones";
import {
  memeCaptionPayloadValues,
  type MemeCaptionPayload,
} from "@/app/quiz/memeCaption";

export const MEME_CAPTION_MAX_LINES = 2;
export const MEME_CAPTION_MIN_FONT_CQW = 4.5;
export const MEME_CAPTION_EXTERNAL_MIN_FONT_CQW = 2.25;
export const MEME_CAPTION_PREFERRED_FONT_CQW = 7.5;
export const MEME_CAPTION_FONT_STEP_CQW = 0.25;
export const MEME_CAPTION_TOO_LONG_MESSAGE =
  "Dein Text ist zu lang. Kürze ihn, damit er im Meme gut lesbar bleibt.";

const LINE_CAPACITY_AT_MIN_FONT = 26;
export const MEME_CAPTION_SINGLE_LINE_ROW_PERCENT = 13;
export const MEME_CAPTION_DOUBLE_LINE_ROW_PERCENT = 21;
const MEME_CANVAS_HEIGHT_CQW = 75;
const CAPTION_ROW_HEIGHT_CQW = MEME_CANVAS_HEIGHT_CQW * (MEME_CAPTION_DOUBLE_LINE_ROW_PERCENT / 100);
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

function lineCapacity(fontSizeCqw: number, widthPercent = 100) {
  return LINE_CAPACITY_AT_MIN_FONT *
    (MEME_CAPTION_MIN_FONT_CQW / fontSizeCqw) *
    (widthPercent / 100);
}

function verticalLineCapacity(
  fontSizeCqw: number,
  heightCqw = CAPTION_ROW_HEIGHT_CQW,
  maxLines = MEME_CAPTION_MAX_LINES,
) {
  return Math.min(
    maxLines,
    Math.floor(
      (heightCqw - CAPTION_VERTICAL_PADDING_CQW) /
      (fontSizeCqw * CAPTION_LINE_HEIGHT),
    ),
  );
}

export function analyzeMemeCaptionLayout(
  text: string,
  zone?: MemeCaptionZone,
  imageHeightCqw = 75,
  externalHeightCqw = CAPTION_ROW_HEIGHT_CQW,
): MemeCaptionLayoutAnalysis {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      fits: true,
      fontSizeCqw: MEME_CAPTION_PREFERRED_FONT_CQW,
      lineCount: 0,
    };
  }

  const widthPercent = zone?.placement === "IMAGE"
    ? Math.max(1, ((zone.width - 6) / 94) * 100)
    : 100;
  const heightCqw = zone?.placement === "IMAGE"
    ? imageHeightCqw * (zone.height / 100)
    : externalHeightCqw;
  const maxLines = zone?.maxLines ?? MEME_CAPTION_MAX_LINES;
  const minimumFontSize = zone?.placement === "IMAGE"
    ? MEME_CAPTION_MIN_FONT_CQW
    : MEME_CAPTION_EXTERNAL_MIN_FONT_CQW;

  for (
    let fontSize = MEME_CAPTION_PREFERRED_FONT_CQW;
    fontSize >= minimumFontSize;
    fontSize -= MEME_CAPTION_FONT_STEP_CQW
  ) {
    const lineCount = countMemeCaptionLines(trimmed, lineCapacity(fontSize, widthPercent));
    if (lineCount <= verticalLineCapacity(fontSize, heightCqw, maxLines)) {
      return { fits: true, fontSizeCqw: fontSize, lineCount };
    }
  }

  return {
    fits: false,
    fontSizeCqw: minimumFontSize,
    lineCount: countMemeCaptionLines(
      trimmed,
      lineCapacity(minimumFontSize, widthPercent),
    ),
  };
}

export function getExternalMemeCaptionRowPercent(text: string, zone?: MemeCaptionZone) {
  if (!text.trim()) return 0;
  const analysis = analyzeMemeCaptionLayout(text, zone);
  return analysis.lineCount <= 1
    ? MEME_CAPTION_SINGLE_LINE_ROW_PERCENT
    : MEME_CAPTION_DOUBLE_LINE_ROW_PERCENT;
}

export function getExternalMemeCaptionRowHeightCqw(text: string, zone?: MemeCaptionZone) {
  return MEME_CANVAS_HEIGHT_CQW * (getExternalMemeCaptionRowPercent(text, zone) / 100);
}

export function isMemeCaptionPayloadReadable(
  payload: MemeCaptionPayload,
  layout: ResolvedMemeCaptionLayout = resolveMemeCaptionLayout(null),
) {
  const values = memeCaptionPayloadValues(payload).captions;
  const allowedZoneIds = new Set(layout.zones.map((zone) => zone.id));
  if (Object.keys(values).some((zoneId) => !allowedZoneIds.has(zoneId))) return false;
  const externalHeight = layout.zones.reduce((sum, zone) => {
    if (zone.placement === "IMAGE" || !(values[zone.id] ?? "")) return sum;
    return sum + getExternalMemeCaptionRowHeightCqw(values[zone.id] ?? "", zone);
  }, 0);
  const imageHeightCqw = 75 - externalHeight;
  return layout.zones.every((zone) => {
    const text = values[zone.id] ?? "";
    if (zone.required && !text) return false;
    const externalHeightCqw = zone.placement === "IMAGE"
      ? CAPTION_ROW_HEIGHT_CQW
      : getExternalMemeCaptionRowHeightCqw(text, zone);
    return analyzeMemeCaptionLayout(text, zone, imageHeightCqw, externalHeightCqw).fits;
  });
}
