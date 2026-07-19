import type { MediaSlotKey, QuestionMediaType } from "./types";

export type MediaSlotScope = "QUESTION" | "ANSWER" | "ANSWER_FIELD";
export type MediaSlotOrigin = "USER" | "GENERATED" | "USER_OR_GENERATED";

export type MediaSlotDefinition = {
  key: MediaSlotKey;
  scope: MediaSlotScope;
  mediaType: QuestionMediaType;
  maximumItems: 1;
  allowedMimeTypes: readonly string[];
  maxFileSizeBytes: number;
  origin: MediaSlotOrigin;
  manualUploadAllowed: boolean;
  generatorInput: boolean;
  generatorOutput: boolean;
  previewType: "IMAGE" | "AUDIO" | "VIDEO";
  labelKey: "questionImage" | "questionAudio" | "questionVideo" | "answerImage" | "faceMorphResult" | "musicOriginalAudio" | "musicReverseAudio" | "musicBitcrushAudio" | "pixelOriginalImage" | "pixelResultImage" | "pixelStage3Image" | "pixelStage2Image" | "pixelStage1Image" | "preparedSlot";
  helpKey: MediaSlotDefinition["labelKey"];
};

type MediaKindRule = {
  accept: string;
  extensions: readonly string[];
  mimeTypes: readonly string[];
  maximumSizeInBytes: number;
  sizeLabel: string;
};

export const mediaKindRules: Record<QuestionMediaType, MediaKindRule> = {
  IMAGE: {
    accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maximumSizeInBytes: 10 * 1024 * 1024,
    sizeLabel: "10 MB",
  },
  AUDIO: {
    accept: ".mp3,.m4a,.mp4,.wav,.ogg,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/ogg",
    extensions: ["mp3", "m4a", "mp4", "wav", "ogg"],
    mimeTypes: ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/ogg"],
    maximumSizeInBytes: 25 * 1024 * 1024,
    sizeLabel: "25 MB",
  },
  VIDEO: {
    accept: ".mp4,.webm,video/mp4,video/webm",
    extensions: ["mp4", "webm"],
    mimeTypes: ["video/mp4", "video/webm"],
    maximumSizeInBytes: 100 * 1024 * 1024,
    sizeLabel: "100 MB",
  },
};

function slot(
  key: MediaSlotKey,
  scope: MediaSlotScope,
  mediaType: QuestionMediaType,
  labelKey: MediaSlotDefinition["labelKey"] = "preparedSlot",
  options: Partial<Pick<MediaSlotDefinition, "origin" | "manualUploadAllowed" | "generatorInput" | "generatorOutput">> = {},
): MediaSlotDefinition {
  const rules = mediaKindRules[mediaType];
  return {
    key, scope, mediaType, maximumItems: 1,
    allowedMimeTypes: rules.mimeTypes,
    maxFileSizeBytes: rules.maximumSizeInBytes,
    origin: options.origin ?? "USER",
    manualUploadAllowed: options.manualUploadAllowed ?? true,
    generatorInput: options.generatorInput ?? false,
    generatorOutput: options.generatorOutput ?? false,
    previewType: mediaType,
    labelKey, helpKey: labelKey,
  };
}

export const mediaSlotDefinitions = {
  question_image: slot("question_image", "QUESTION", "IMAGE", "questionImage"),
  question_audio: slot("question_audio", "QUESTION", "AUDIO", "questionAudio"),
  question_video: slot("question_video", "QUESTION", "VIDEO", "questionVideo"),
  answer_image: slot("answer_image", "ANSWER", "IMAGE", "answerImage"),
  face_morph_result: slot("face_morph_result", "QUESTION", "IMAGE", "faceMorphResult", { origin: "USER_OR_GENERATED", generatorOutput: true }),
  face_morph_person_a_original: slot("face_morph_person_a_original", "QUESTION", "IMAGE", "preparedSlot", { generatorInput: true }),
  face_morph_person_b_original: slot("face_morph_person_b_original", "QUESTION", "IMAGE", "preparedSlot", { generatorInput: true }),
  music_original_audio: slot("music_original_audio", "QUESTION", "AUDIO", "musicOriginalAudio", { generatorInput: true }),
  music_reverse_audio: slot("music_reverse_audio", "QUESTION", "AUDIO", "musicReverseAudio", { origin: "GENERATED", manualUploadAllowed: false, generatorOutput: true }),
  music_bitcrush_audio: slot("music_bitcrush_audio", "QUESTION", "AUDIO", "musicBitcrushAudio", { origin: "GENERATED", manualUploadAllowed: false, generatorOutput: true }),
  pixel_original_image: slot("pixel_original_image", "QUESTION", "IMAGE", "pixelOriginalImage", { generatorInput: true }),
  pixel_result_image: slot("pixel_result_image", "QUESTION", "IMAGE", "pixelResultImage", { origin: "GENERATED", manualUploadAllowed: false, generatorOutput: true }),
  pixel_stage_3_image: slot("pixel_stage_3_image", "QUESTION", "IMAGE", "pixelStage3Image", { origin: "GENERATED", manualUploadAllowed: false, generatorOutput: true }),
  pixel_stage_2_image: slot("pixel_stage_2_image", "QUESTION", "IMAGE", "pixelStage2Image", { origin: "GENERATED", manualUploadAllowed: false, generatorOutput: true }),
  pixel_stage_1_image: slot("pixel_stage_1_image", "QUESTION", "IMAGE", "pixelStage1Image", { origin: "GENERATED", manualUploadAllowed: false, generatorOutput: true }),
  lyrics_tts_audio: slot("lyrics_tts_audio", "QUESTION", "AUDIO", "preparedSlot", { origin: "GENERATED", manualUploadAllowed: false, generatorOutput: true }),
} satisfies Record<MediaSlotKey, MediaSlotDefinition>;

export function isMediaSlotKey(value: unknown): value is MediaSlotKey {
  return typeof value === "string" && value in mediaSlotDefinitions;
}

export function getMediaSlotDefinition(key: MediaSlotKey) {
  return mediaSlotDefinitions[key];
}

export function isMediaSlotAllowedForTemplate(
  templateSlots: ReadonlyArray<{ slotKey: MediaSlotKey }>,
  key: MediaSlotKey,
) {
  return templateSlots.some((slotDefinition) => slotDefinition.slotKey === key);
}

export function inferLegacyQuestionSlot(
  templateId: string | null,
  mediaType: QuestionMediaType,
): MediaSlotKey | null {
  if (templateId === "face_morph" && mediaType === "IMAGE") return "face_morph_result";
  if (templateId === "musik_rueckwaerts" && mediaType === "AUDIO") return "music_reverse_audio";
  if (templateId === "eight_bit" && mediaType === "AUDIO") return "music_bitcrush_audio";
  if (templateId === "pixelbild" && mediaType === "IMAGE") return "pixel_result_image";
  if ((templateId === null || templateId === "standard" || templateId === "multiple_choice") && mediaType === "IMAGE") return "question_image";
  return null;
}

export function hasExactlyOneMediaOwner(owner: {
  questionId?: number | null;
  answerId?: number | null;
  answerFieldId?: number | null;
}) {
  return [owner.questionId, owner.answerId, owner.answerFieldId].filter(
    (value) => value !== null && value !== undefined,
  ).length === 1;
}
