import type { QuestionMediaDraft, QuestionMediaType } from "./types";

type QuestionMediaRule = {
  accept: string;
  extensions: readonly string[];
  mimeTypes: readonly string[];
  maximumSizeInBytes: number;
  sizeLabel: string;
};

export const questionMediaRules: Record<
  QuestionMediaType,
  QuestionMediaRule
> = {
  IMAGE: {
    accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maximumSizeInBytes: 10 * 1024 * 1024,
    sizeLabel: "10 MB",
  },
  AUDIO: {
    accept: ".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/x-wav,audio/ogg",
    extensions: ["mp3", "wav", "ogg"],
    mimeTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
    ],
    maximumSizeInBytes: 25 * 1024 * 1024,
    sizeLabel: "25 MB",
  },
};

function getFileExtension(fileName: string) {
  const pathname = fileName.split(/[?#]/, 1)[0];
  const extension = pathname.split(".").pop();

  return extension?.toLowerCase() ?? "";
}

export function validateQuestionMediaFile(
  file: Pick<File, "name" | "size" | "type">,
  mediaType: QuestionMediaType,
) {
  const rule = questionMediaRules[mediaType];

  if (!rule.extensions.includes(getFileExtension(file.name))) {
    return `Dieses Dateiformat wird nicht unterstützt. Erlaubt: ${rule.extensions
      .map((extension) => extension.toUpperCase())
      .join(", ")}.`;
  }

  if (!rule.mimeTypes.includes(file.type.toLowerCase())) {
    return "Der gemeldete Dateityp wird nicht unterstützt.";
  }

  if (file.size > rule.maximumSizeInBytes) {
    return `Die Datei darf höchstens ${rule.sizeLabel} groß sein.`;
  }

  return null;
}

export function isAllowedQuestionMediaPathname(
  pathname: string,
  mediaType: QuestionMediaType,
  target: "QUESTION" | "ANSWER",
  pathnamePrefix: string,
) {
  const directory = mediaType === "IMAGE" ? "image" : "audio";
  const baseDirectory = `${pathnamePrefix}${target.toLowerCase()}/${directory}/`;

  return (
    pathname.startsWith(baseDirectory) &&
    questionMediaRules[mediaType].extensions.includes(
      getFileExtension(pathname),
    )
  );
}

type StoredMedia = {
  medien_id: number;
  datei: string;
  medientyp: { medientyp: string };
};

export function resolveQuestionMediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
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

  return null;
}

export function createQuestionMediaDraftFromStoredMedia(
  media: StoredMedia[],
): QuestionMediaDraft | null {
  if (media.length === 0) {
    return null;
  }

  if (media.length > 1) {
    return {
      existingMediaId: null,
      url: null,
      mediaType: null,
      operation: "UNCHANGED",
      existingMediaCount: media.length,
      blockedReason: `Diese Frage besitzt ${media.length} Fragenmedien. Der MVP unterstützt genau ein Medium.`,
    };
  }

  const medium = media[0];
  const mediaType = getQuestionMediaTypeFromName(medium.medientyp.medientyp);

  return {
    existingMediaId: medium.medien_id,
    url: medium.datei,
    mediaType,
    fileName: getQuestionMediaFileName(medium.datei),
    operation: "UNCHANGED",
    existingMediaCount: 1,
    blockedReason: mediaType
      ? undefined
      : `Der vorhandene Medientyp „${medium.medientyp.medientyp}“ wird im MVP nicht unterstützt.`,
  };
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
  const blockedReason =
    media.length > 1
      ? `Diese Antwort besitzt ${media.length} Medien. Der MVP unterstützt genau ein Bild.`
      : mediaType !== "IMAGE"
        ? `Der vorhandene Medientyp „${selectedMedia.medientyp.medientyp}“ wird für Antworten nicht unterstützt.`
        : undefined;

  return {
    existingMediaId: selectedMedia.medien_id,
    url: mediaType === "IMAGE" ? selectedMedia.datei : null,
    mediaType: mediaType === "IMAGE" ? "IMAGE" : null,
    fileName:
      mediaType === "IMAGE"
        ? getQuestionMediaFileName(selectedMedia.datei)
        : undefined,
    operation: "UNCHANGED",
    existingMediaCount: media.length,
    blockedReason,
  };
}
