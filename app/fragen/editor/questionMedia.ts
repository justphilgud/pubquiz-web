import type { QuestionMediaDraft, QuestionMediaType } from "./types";
import type { MediaSlotKey } from "./types";
import {
  getMediaSlotDefinition,
  inferLegacyQuestionSlot,
  isMediaSlotKey,
  mediaKindRules,
} from "./mediaSlots";
import {
  buildBlobPath,
  type BlobEnvironmentPrefix,
} from "@/app/lib/blobPath";

export const questionMediaRules = mediaKindRules;

function getFileExtension(fileName: string) {
  const pathname = fileName.split(/[?#]/, 1)[0];
  const extension = pathname.split(".").pop();

  return extension?.toLowerCase() ?? "";
}

export function validateQuestionMediaFile(
  file: Pick<File, "name" | "size" | "type">,
  mediaType: QuestionMediaType,
): { code: "INVALID_EXTENSION" | "INVALID_MIME" | "TOO_LARGE"; params: Record<string, string | number> } | null {
  const rule = questionMediaRules[mediaType];

  if (!rule.extensions.includes(getFileExtension(file.name))) {
    return {
      code: "INVALID_EXTENSION" as const,
      params: { extensions: rule.extensions.map((extension) => extension.toUpperCase()).join(", ") },
    };
  }

  if (!rule.mimeTypes.includes(file.type.toLowerCase())) {
    return { code: "INVALID_MIME" as const, params: {} };
  }

  if (file.size > rule.maximumSizeInBytes) {
    return { code: "TOO_LARGE" as const, params: { size: rule.sizeLabel } };
  }

  return null;
}

export function isAllowedQuestionMediaPathname(
  pathname: string,
  mediaType: QuestionMediaType,
  target: "QUESTION" | "ANSWER",
  environmentPrefix: BlobEnvironmentPrefix,
  slotKey: MediaSlotKey,
) {
  const directory = mediaType.toLowerCase();
  const area = target === "QUESTION" ? "question-media" : "answer-media";
  const baseDirectory = `${buildBlobPath(environmentPrefix, area, [slotKey, directory])}/`;

  return (
    pathname.startsWith(baseDirectory) &&
    questionMediaRules[mediaType].extensions.includes(
      getFileExtension(pathname),
    )
  );
}

export function buildQuestionMediaPathname(
  environmentPrefix: BlobEnvironmentPrefix,
  target: "QUESTION" | "ANSWER",
  mediaType: QuestionMediaType,
  slotKey: MediaSlotKey,
  fileName: string,
) {
  return buildBlobPath(
    environmentPrefix,
    target === "QUESTION" ? "question-media" : "answer-media",
    [slotKey, mediaType.toLowerCase(), fileName],
  );
}

type StoredMedia = {
  medien_id: number;
  datei: string;
  medientyp: { medientyp: string };
  slot_key?: string | null;
};

export function resolveQuestionMediaUrl(url: string) {
  return url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/medien/")
    ? url
    : `/medien/${url.replace(/^\/+/, "")}`;
}

export function getQuestionMediaFileName(url: string) {
  const pathname = url.split(/[?#]/, 1)[0];
  const fileName = pathname.split("/").pop();

  if (!fileName) {
    return "Medium";
  }

  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

export function getQuestionMediaTypeFromName(typeName: string) {
  const normalizedName = typeName.trim().toLowerCase();

  if (normalizedName.includes("bild") || normalizedName.includes("image")) {
    return "IMAGE" as const;
  }

  if (normalizedName.includes("audio")) {
    return "AUDIO" as const;
  }

  if (normalizedName.includes("video")) {
    return "VIDEO" as const;
  }

  return null;
}

export function createQuestionMediaDraftFromStoredMedia(
  media: StoredMedia[],
  templateId: string | null = null,
): QuestionMediaDraft[] {
  const drafts = media.map((medium): QuestionMediaDraft => {
    const mediaType = getQuestionMediaTypeFromName(medium.medientyp.medientyp);
    const explicitSlot = isMediaSlotKey(medium.slot_key) ? medium.slot_key : null;
    const inferredSlot = mediaType
      ? inferLegacyQuestionSlot(templateId, mediaType)
      : null;
    const slotKey = explicitSlot ?? inferredSlot ?? "question_image";
    const slotDefinition = getMediaSlotDefinition(slotKey);
    const hasConflict = Boolean(
      mediaType &&
      (slotDefinition.scope !== "QUESTION" || slotDefinition.mediaType !== mediaType),
    );

    return {
      slotKey,
      existingMediaId: medium.medien_id,
      url: medium.datei,
      mediaType,
      fileName: getQuestionMediaFileName(medium.datei),
      operation: "UNCHANGED",
      existingMediaCount: 1,
      blockedReasonCode: !mediaType
        ? "UNSUPPORTED_QUESTION_MEDIA_TYPE"
        : medium.slot_key && !explicitSlot
          ? "UNKNOWN_MEDIA_SLOT"
          : !explicitSlot && !inferredSlot
            ? "MEDIA_SLOT_CONFLICT"
            : hasConflict
              ? "MEDIA_SLOT_CONFLICT"
              : undefined,
      blockedReasonParams: { slot: medium.slot_key ?? slotKey, type: medium.medientyp.medientyp },
    };
  });

  const counts = new Map<MediaSlotKey, number>();
  for (const draft of drafts) counts.set(draft.slotKey, (counts.get(draft.slotKey) ?? 0) + 1);
  return drafts.map((draft) =>
    (counts.get(draft.slotKey) ?? 0) > 1
      ? { ...draft, blockedReasonCode: "MULTIPLE_QUESTION_MEDIA", blockedReasonParams: { count: counts.get(draft.slotKey) ?? 0 } }
      : draft,
  );
}

export function createAnswerMediaDraftFromStoredMedia(
  media: StoredMedia[],
): QuestionMediaDraft | null {
  if (media.length === 0) {
    return null;
  }

  const supportedImage = media.find(
    (medium) =>
      getQuestionMediaTypeFromName(medium.medientyp.medientyp) === "IMAGE",
  );
  const selectedMedia = supportedImage ?? media[0];
  const mediaType = getQuestionMediaTypeFromName(
    selectedMedia.medientyp.medientyp,
  );
  const blockedReasonCode =
    media.length > 1
      ? "MULTIPLE_ANSWER_MEDIA" as const
      : mediaType !== "IMAGE"
        ? "UNSUPPORTED_ANSWER_MEDIA_TYPE" as const
        : undefined;

  return {
    slotKey: "answer_image",
    existingMediaId: selectedMedia.medien_id,
    url: mediaType === "IMAGE" ? selectedMedia.datei : null,
    mediaType: mediaType === "IMAGE" ? "IMAGE" : null,
    fileName:
      mediaType === "IMAGE"
        ? getQuestionMediaFileName(selectedMedia.datei)
        : undefined,
    operation: "UNCHANGED",
    existingMediaCount: media.length,
    blockedReasonCode,
    blockedReasonParams: blockedReasonCode === "MULTIPLE_ANSWER_MEDIA"
      ? { count: media.length }
      : blockedReasonCode === "UNSUPPORTED_ANSWER_MEDIA_TYPE"
        ? { type: selectedMedia.medientyp.medientyp }
        : undefined,
  };
}
