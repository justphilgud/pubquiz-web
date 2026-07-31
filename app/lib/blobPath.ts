export type BlobEnvironmentPrefix = "dev" | "preview" | "prod";

export type BlobPathArea =
  | "question-media"
  | "answer-media"
  | "template-media"
  | "media";

function assertSafePathSegment(segment: string) {
  if (
    !segment ||
    segment === "." ||
    segment === ".." ||
    segment.includes("/") ||
    segment.includes("\\")
  ) {
    throw new Error("Ungültiges Blob-Pfadsegment.");
  }
}

export function buildBlobPath(
  environmentPrefix: BlobEnvironmentPrefix,
  area: BlobPathArea,
  segments: readonly string[] = [],
) {
  segments.forEach(assertSafePathSegment);

  return `${environmentPrefix}/${area}/${segments.join("/")}`;
}

export function getBlobAreaPrefix(
  environmentPrefix: BlobEnvironmentPrefix,
  area: BlobPathArea,
) {
  return `${buildBlobPath(environmentPrefix, area)}/`;
}
