import "server-only";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { head } from "@vercel/blob";
import { verifyLogoImageBytes } from "./eventSeriesLogoImage";
import { getMediaVerificationServerConfig } from "@/app/fragen/editor/mediaUploadEnvironment";
import { eventSeriesLogoRule, isAllowedEventSeriesLogoPath, isPublicLogoBlobUrl, validateEventSeriesLogoFile } from "./eventSeriesLogo";

export async function verifyEventSeriesLogo(url: string, eventSeriesId: number) {
  return verifyEventImage(url, (path, prefix) => isAllowedEventSeriesLogoPath(path, prefix, eventSeriesId));
}

export async function verifyEventImage(url: string, isAllowedPath: (path: string, prefix: BlobEnvironmentPrefix) => boolean) {
  if (!isPublicLogoBlobUrl(url)) throw new Error("Ungültige Logo-URL.");
  const config = getMediaVerificationServerConfig();
  const parsed = new URL(url);
  if (!isAllowedPath(parsed.pathname.slice(1), config.environmentPrefix)) {
    throw new Error("Das Logo gehört nicht zu dieser Eventreihe und Umgebung.");
  }
  const metadata = await head(url, config.blobAuthentication);
  if (!isAllowedPath(metadata.pathname, config.environmentPrefix) ||
    validateEventSeriesLogoFile({ name: metadata.pathname, type: metadata.contentType, size: metadata.size })) {
    throw new Error("Ungültige Logodatei oder Dateigröße.");
  }
  // Verify actual bytes, not merely a user-supplied extension or Content-Type.
  const response = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.body) throw new Error("Logo konnte nicht geprüft werden.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > eventSeriesLogoRule.maximumSizeInBytes) throw new Error("Logo ist zu groß.");
      chunks.push(result.value);
    }
  } finally { await reader.cancel(); }
  await verifyLogoImageBytes(Buffer.concat(chunks));
  // No resize/re-encode: preserve aspect ratio, original pixels and alpha.
  return url;
}
