export type BlobEnvironmentPrefix = "dev" | "preview" | "prod";

export type BlobPathArea =
  | "question-media"
  | "answer-media"
  | "template-media"
  | "team-profile"
  | "media";

export function isSafeBlobPathSegment(segment: string) {
  let decodedSegment: string;
  try {
    decodedSegment = decodeURIComponent(segment);
  } catch {
    return false;
  }

  return Boolean(
    decodedSegment &&
      decodedSegment !== "." &&
      decodedSegment !== ".." &&
      !decodedSegment.includes("/") &&
      !decodedSegment.includes("\\"),
  );
}

function assertSafePathSegment(segment: string) {
  if (!isSafeBlobPathSegment(segment)) {
    throw new Error("Ungültiges Blob-Pfadsegment.");
  }
}

export function buildBlobPath(
  environmentPrefix: BlobEnvironmentPrefix,
  area: BlobPathArea,
  segments: readonly string[] = [],
) {
  segments.forEach(assertSafePathSegment);

  return [environmentPrefix, area, ...segments].join("/");
}

export function getBlobAreaPrefix(
  environmentPrefix: BlobEnvironmentPrefix,
  area: BlobPathArea,
) {
  return `${buildBlobPath(environmentPrefix, area)}/`;
}
