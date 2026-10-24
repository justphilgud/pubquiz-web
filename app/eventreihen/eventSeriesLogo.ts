import { buildBlobPath, isSafeBlobPathSegment, type BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { sanitizeSlideMediaFileName } from "@/app/quiz/slideMediaUpload";

export const eventSeriesLogoRule = {
  mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  maximumSizeInBytes: 5 * 1024 * 1024,
  accept: ".png,.jpg,.jpeg,.webp",
};
export function buildEventSeriesLogoPath(prefix: BlobEnvironmentPrefix, id: number, fileName: string) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Ungültige Eventreihe.");
  return buildBlobPath(prefix, "event-series", [String(id), "logo", sanitizeSlideMediaFileName(fileName)]);
}
export function isAllowedEventSeriesLogoPath(path: string, prefix: BlobEnvironmentPrefix, id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  const directory = `${buildBlobPath(prefix, "event-series", [String(id), "logo"])}/`;
  if (!path.startsWith(directory)) return false;
  const name = path.slice(directory.length);
  return isSafeBlobPathSegment(name) && /^[a-z0-9_-][a-z0-9._-]*\.(png|jpe?g|webp)$/i.test(name);
}
export function validateEventSeriesLogoFile(file: { name: string; type: string; size: number }) {
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) || !eventSeriesLogoRule.mimeTypes.includes(file.type)) {
    return "Bitte ein PNG-, JPEG- oder WebP-Bild auswählen.";
  }
  if (file.size <= 0 || file.size > eventSeriesLogoRule.maximumSizeInBytes) return "Das Logo darf maximal 5 MB groß sein und nicht leer sein.";
  return null;
}
export function isPublicLogoBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname) &&
      !url.username && !url.password && !url.port && !url.search && !url.hash;
  } catch { return false; }
}
