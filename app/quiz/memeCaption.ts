import type { Prisma } from "@/app/generated/prisma/client";

export const MEME_CAPTION_TEXT_MAX_LENGTH = 80;
export const MEME_RESPONSE_DURATION_MIN_SECONDS = 60;
export const MEME_RESPONSE_DURATION_MAX_SECONDS = 600;
export const MEME_MAX_PRESENTED_MIN = 1;
export const MEME_MAX_PRESENTED_MAX = 100;

type MemeTimerConfig =
  | { timerEnabled: true; responseDurationSeconds: number }
  | { timerEnabled: false; responseDurationSeconds: null };

export type MemeQuestionConfig = MemeTimerConfig & {
  version: 1;
  maxPresentedMemes: number | null;
};

export type MemeCaptionPayload = {
  topText: string;
  bottomText: string;
} | {
  captions: Record<string, string>;
};

export type MemeCaptionValues = {
  captions: Record<string, string>;
};

export type MemeLiveState = MemeTimerConfig & {
  state: "LOCKED" | "OPEN" | "COUNTDOWN" | "CLOSED" | "REVEALED";
  deadlineAt: string | null;
  maxPresentedMemes: number | null;
};

export const DEFAULT_MEME_QUESTION_CONFIG: MemeQuestionConfig = {
  version: 1,
  timerEnabled: true,
  responseDurationSeconds: 90,
  maxPresentedMemes: 5,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseMemeQuestionConfig(value: unknown): MemeQuestionConfig | null {
  if (value === null || value === undefined) return DEFAULT_MEME_QUESTION_CONFIG;
  if (!isRecord(value) || value.version !== 1) return null;
  const timerEnabled = value.timerEnabled === undefined ? true : value.timerEnabled;
  const duration = value.responseDurationSeconds;
  const maximum = value.maxPresentedMemes;
  if (
    typeof timerEnabled !== "boolean" ||
    (timerEnabled && (
      !Number.isSafeInteger(duration) ||
      Number(duration) < MEME_RESPONSE_DURATION_MIN_SECONDS ||
      Number(duration) > MEME_RESPONSE_DURATION_MAX_SECONDS
    )) ||
    (!timerEnabled && duration !== null)
  ) {
    return null;
  }
  if (
    maximum !== null &&
    (!Number.isSafeInteger(maximum) ||
      Number(maximum) < MEME_MAX_PRESENTED_MIN ||
      Number(maximum) > MEME_MAX_PRESENTED_MAX)
  ) {
    return null;
  }
  const maxPresentedMemes = maximum === null ? null : Number(maximum);
  return timerEnabled
    ? {
        version: 1,
        timerEnabled: true,
        responseDurationSeconds: Number(duration),
        maxPresentedMemes,
      }
    : {
        version: 1,
        timerEnabled: false,
        responseDurationSeconds: null,
        maxPresentedMemes,
      };
}

export function parseMemeCaptionPayload(value: unknown): MemeCaptionPayload | null {
  if (!isRecord(value)) return null;
  if (typeof value.topText === "string" && typeof value.bottomText === "string") {
    if (
      value.topText.length > MEME_CAPTION_TEXT_MAX_LENGTH ||
      value.bottomText.length > MEME_CAPTION_TEXT_MAX_LENGTH
    ) return null;
    const payload = {
      topText: value.topText.trim(),
      bottomText: value.bottomText.trim(),
    };
    return payload;
  }
  if (!isRecord(value.captions)) return null;
  const captions: Record<string, string> = {};
  for (const [key, caption] of Object.entries(value.captions)) {
    if (
      !/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(key) ||
      typeof caption !== "string" ||
      caption.length > MEME_CAPTION_TEXT_MAX_LENGTH
    ) return null;
    captions[key] = caption.trim();
  }
  return { captions };
}

export function serializeMemeCaptionPayload(payload: MemeCaptionPayload) {
  return JSON.stringify(payload);
}

export function parseStoredMemeCaptionPayload(value: string | null): MemeCaptionPayload {
  if (!value) return { topText: "", bottomText: "" };
  try {
    return parseMemeCaptionPayload(JSON.parse(value)) ?? { topText: "", bottomText: "" };
  } catch {
    return { topText: "", bottomText: "" };
  }
}

export function memeCaptionPayloadValues(payload: MemeCaptionPayload): MemeCaptionValues {
  return "captions" in payload
    ? { captions: { ...payload.captions } }
    : { captions: { top: payload.topText, bottom: payload.bottomText } };
}

export function parseStoredMemeCaptionValues(value: string | null): MemeCaptionValues {
  const payload = parseStoredMemeCaptionPayload(value);
  return memeCaptionPayloadValues(payload);
}

export function hasMemeCaptionContent(payload: MemeCaptionPayload) {
  return Object.values(memeCaptionPayloadValues(payload).captions).some(Boolean);
}

export function createMemeLiveConfigSnapshot(config: MemeQuestionConfig) {
  return { type: "MEME_CAPTION" as const, ...config };
}

export function memeCountdownRemainingSeconds(
  deadlineAt: string | null,
  state: MemeLiveState["state"],
  now: number,
) {
  if (state === "CLOSED" || state === "REVEALED") return 0;
  if (!deadlineAt) return null;
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 1_000));
}

export function createMemeRunWindow(config: MemeQuestionConfig, openedAt: Date) {
  if (!config.timerEnabled) {
    return {
      state: "OPEN" as const,
      openedAt,
      deadlineAt: null,
    };
  }
  return {
    state: "COUNTDOWN" as const,
    openedAt,
    deadlineAt: new Date(
      openedAt.getTime() + config.responseDurationSeconds * 1_000,
    ),
  };
}

export function readMemeLiveConfigSnapshot(value: Prisma.JsonValue) {
  if (!isRecord(value) || !isRecord(value.liveInteraction)) return null;
  if (value.liveInteraction.type !== "MEME_CAPTION") return null;
  return parseMemeQuestionConfig(value.liveInteraction);
}
