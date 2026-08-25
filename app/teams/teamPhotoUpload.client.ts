"use client";

import { uploadPresigned } from "@vercel/blob/client";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import type { TeamProfile } from "./teamProfile";
import { buildTeamPhotoUploadPathname, type TeamPhotoUploadContext, validateTeamPhotoUpload } from "./teamPhotoUpload";

type TeamPhotoUploadResult = { success: boolean; profile?: TeamProfile; message?: string };

export class TeamPhotoUploadResponseError extends Error {
  constructor(
    message: string,
    public readonly details: {
      status: number | null;
      contentType: string | null;
      responseKind: "HTML" | "NON_JSON" | "INVALID_JSON" | "UPLOAD";
    },
  ) {
    super(message);
    this.name = "TeamPhotoUploadResponseError";
  }
}

export async function readTeamPhotoUploadResponse(response: Response) {
  const contentType = response.headers.get("content-type");
  if (!contentType?.toLowerCase().includes("application/json")) {
    const body = await response.text();
    throw new TeamPhotoUploadResponseError("Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.", {
      status: response.status,
      contentType,
      responseKind: /<!doctype|<html/i.test(body) ? "HTML" : "NON_JSON",
    });
  }

  let result: unknown;
  try {
    result = JSON.parse(await response.text());
  } catch {
    throw new TeamPhotoUploadResponseError("Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.", {
      status: response.status,
      contentType,
      responseKind: "INVALID_JSON",
    });
  }

  if (!result || typeof result !== "object") {
    throw new TeamPhotoUploadResponseError("Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.", {
      status: response.status,
      contentType,
      responseKind: "INVALID_JSON",
    });
  }

  const parsed = result as TeamPhotoUploadResult;
  if (!response.ok || !parsed.success || !parsed.profile) {
    throw new TeamPhotoUploadResponseError(parsed.message || "Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.", {
      status: response.status,
      contentType,
      responseKind: "UPLOAD",
    });
  }
  return parsed.profile;
}

export async function uploadTeamPhoto(file: File, environmentPrefix: BlobEnvironmentPrefix, context: TeamPhotoUploadContext) {
  validateTeamPhotoUpload(file);
  const pathname = buildTeamPhotoUploadPathname(environmentPrefix, context.teamId, file.name);
  const blob = await uploadPresigned(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/team-profile-photo",
    clientPayload: JSON.stringify(context),
  });
  const response = await fetch("/api/team-profile-photo", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "FINALIZE", context, blobUrl: blob.url }),
  });
  return readTeamPhotoUploadResponse(response);
}
