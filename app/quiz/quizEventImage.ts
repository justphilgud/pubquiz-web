import { buildBlobPath, isSafeBlobPathSegment, type BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { sanitizeSlideMediaFileName } from "./slideMediaUpload";

export function buildQuizEventImagePath(prefix: BlobEnvironmentPrefix, id: number, name: string) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Ungültiges Quiz.");
  return buildBlobPath(prefix, "media", ["quiz-events", String(id), sanitizeSlideMediaFileName(name)]);
}
export function isAllowedQuizEventImagePath(path: string, prefix: BlobEnvironmentPrefix, id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  const directory = `${buildBlobPath(prefix, "media", ["quiz-events", String(id)])}/`;
  const name = path.slice(directory.length);
  return path.startsWith(directory) && isSafeBlobPathSegment(name) && /^[a-z0-9_-][a-z0-9._-]*\.(png|jpe?g|webp)$/i.test(name);
}
