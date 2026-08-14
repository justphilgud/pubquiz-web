import {
  buildBlobPath,
  isSafeBlobPathSegment,
  type BlobEnvironmentPrefix,
} from "@/app/lib/blobPath";

export const slideMediaUploadSlots = [
  "INTRO_VIDEO",
  "INTRO_AUDIO",
  "OUTRO_AUDIO",
] as const;

export type SlideMediaUploadSlot = (typeof slideMediaUploadSlots)[number];

type SlideMediaUploadDefinition = {
  directory: readonly [string, string];
  extensions: readonly string[];
  mediaType: "AUDIO" | "VIDEO";
  mimeTypes: readonly string[];
  maximumSizeInBytes: number;
  sizeLabel: string;
};

export const slideMediaUploadDefinitions: Record<
  SlideMediaUploadSlot,
  SlideMediaUploadDefinition
> = {
  INTRO_VIDEO: {
    directory: ["video", "intro"],
    extensions: ["mp4", "webm", "mov"],
    mediaType: "VIDEO",
    mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
    maximumSizeInBytes: 100 * 1024 * 1024,
    sizeLabel: "100 MB",
  },
  INTRO_AUDIO: {
    directory: ["audio", "intro"],
    extensions: ["mp3"],
    mediaType: "AUDIO",
    mimeTypes: ["audio/mpeg", "audio/mp3"],
    maximumSizeInBytes: 25 * 1024 * 1024,
    sizeLabel: "25 MB",
  },
  OUTRO_AUDIO: {
    directory: ["audio", "outro"],
    extensions: ["mp3"],
    mediaType: "AUDIO",
    mimeTypes: ["audio/mpeg", "audio/mp3"],
    maximumSizeInBytes: 25 * 1024 * 1024,
    sizeLabel: "25 MB",
  },
};

function getFileExtension(pathname: string) {
  const withoutQuery = pathname.split(/[?#]/, 1)[0];
  return withoutQuery.split(".").pop()?.toLowerCase() ?? "";
}

export function isSlideMediaUploadSlot(
  value: unknown,
): value is SlideMediaUploadSlot {
  return slideMediaUploadSlots.includes(value as SlideMediaUploadSlot);
}

export function sanitizeSlideMediaFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "medium";
}

export function buildSlideMediaUploadPathname(
  environmentPrefix: BlobEnvironmentPrefix,
  slot: SlideMediaUploadSlot,
  fileName: string,
) {
  const definition = slideMediaUploadDefinitions[slot];
  return buildBlobPath(environmentPrefix, "media", [
    ...definition.directory,
    fileName,
  ]);
}

export function isAllowedSlideMediaUploadPathname(
  pathname: string,
  environmentPrefix: BlobEnvironmentPrefix,
  slot: SlideMediaUploadSlot,
) {
  const definition = slideMediaUploadDefinitions[slot];
  const directory = `${buildBlobPath(
    environmentPrefix,
    "media",
    definition.directory,
  )}/`;
  const fileName = pathname.slice(directory.length);

  return (
    pathname.startsWith(directory) &&
    isSafeBlobPathSegment(fileName) &&
    definition.extensions.includes(getFileExtension(pathname))
  );
}

export function validateSlideMediaUploadFile(
  file: Pick<File, "name" | "size" | "type">,
  slot: SlideMediaUploadSlot,
) {
  const definition = slideMediaUploadDefinitions[slot];
  if (!definition.extensions.includes(getFileExtension(file.name))) {
    return `Erlaubt sind ${definition.extensions.map((extension) => extension.toUpperCase()).join(", ")}.`;
  }
  if (!definition.mimeTypes.includes(file.type.toLowerCase())) {
    return "Der Dateityp wird nicht unterstützt.";
  }
  if (file.size > definition.maximumSizeInBytes) {
    return `Die Datei darf höchstens ${definition.sizeLabel} groß sein.`;
  }
  return null;
}
