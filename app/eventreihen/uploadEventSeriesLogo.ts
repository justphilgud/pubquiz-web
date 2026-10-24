"use client";
import { uploadPresigned } from "@vercel/blob/client";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { buildEventSeriesLogoPath, validateEventSeriesLogoFile } from "./eventSeriesLogo";

export async function uploadEventSeriesLogo(file: File, id: number, prefix: BlobEnvironmentPrefix) {
  const error = validateEventSeriesLogoFile(file);
  if (error) throw new Error(error);
  const blob = await uploadPresigned(buildEventSeriesLogoPath(prefix, id, `${crypto.randomUUID()}-${file.name}`), file, {
    access: "public", handleUploadUrl: "/api/question-media-upload",
    clientPayload: JSON.stringify({ target: "EVENT_SERIES_LOGO", eventSeriesId: id }),
  });
  return blob.url;
}
