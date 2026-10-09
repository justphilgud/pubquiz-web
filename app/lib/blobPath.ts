export type BlobEnvironmentPrefix = "dev" | "preview" | "prod" | `preview/${string}`;

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
  if (!/^(?:dev|prod|preview(?:\/[a-f0-9]{64})?)$/.test(environmentPrefix)) {
    throw new Error("Ungültiges Blob-Umgebungspräfix.");
  }
  segments.forEach(assertSafePathSegment);

  return [environmentPrefix, area, ...segments].join("/");
}

export function getBlobAreaPrefix(
  environmentPrefix: BlobEnvironmentPrefix,
  area: BlobPathArea,
) {
  return `${buildBlobPath(environmentPrefix, area)}/`;
}

export function isBlobUrlInArea(
  url: string,
  environmentPrefix: BlobEnvironmentPrefix,
  area: BlobPathArea,
) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.pathname.startsWith(`/${getBlobAreaPrefix(environmentPrefix, area)}`);
  } catch {
    return false;
  }
}
