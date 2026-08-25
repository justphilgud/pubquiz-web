import { buildBlobPath, type BlobEnvironmentPrefix } from "@/app/lib/blobPath";

export const MAX_TEAM_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_TEAM_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type TeamPhotoUploadContext =
  | { mode: "TEAM"; teamId: number; quizId: number; sessionToken: string }
  | { mode: "ADMIN"; teamId: number };

export type TeamPhotoUploadDescriptor = { size: number; type: string };

export function validateTeamPhotoUpload(descriptor: TeamPhotoUploadDescriptor) {
  if (
    !ALLOWED_TEAM_PHOTO_TYPES.includes(descriptor.type as (typeof ALLOWED_TEAM_PHOTO_TYPES)[number]) ||
    descriptor.size <= 0 ||
    descriptor.size > MAX_TEAM_PHOTO_UPLOAD_BYTES
  ) {
    throw new Error("Bitte ein JPG-, PNG- oder WebP-Bild bis 8 MB wählen.");
  }
}

export function buildTeamPhotoUploadPathname(environmentPrefix: BlobEnvironmentPrefix, teamId: number, fileName: string) {
  const extension = fileName.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[0] ?? ".jpg";
  return buildBlobPath(environmentPrefix, "team-profile", ["pending", String(teamId), `${crypto.randomUUID()}${extension}`]);
}

export function isAllowedTeamPhotoUploadPathname(pathname: string, environmentPrefix: BlobEnvironmentPrefix, teamId: number) {
  const prefix = `${buildBlobPath(environmentPrefix, "team-profile", ["pending", String(teamId)])}/`;
  const fileName = pathname.slice(prefix.length);
  return pathname.startsWith(prefix) && /^[a-zA-Z0-9-]+\.(?:jpe?g|png|webp)$/.test(fileName);
}

export function parseTeamPhotoUploadContext(value: unknown): TeamPhotoUploadContext {
  if (!value || typeof value !== "object") throw new Error("Uploadkontext ist ungültig.");
  const mode = Reflect.get(value, "mode");
  const teamId = Number(Reflect.get(value, "teamId"));
  if (!Number.isInteger(teamId) || teamId <= 0) throw new Error("Uploadkontext ist ungültig.");
  if (mode === "ADMIN") return { mode, teamId };
  const quizId = Number(Reflect.get(value, "quizId"));
  const sessionToken = Reflect.get(value, "sessionToken");
  if (mode !== "TEAM" || !Number.isInteger(quizId) || quizId <= 0 || typeof sessionToken !== "string" || !sessionToken) {
    throw new Error("Uploadkontext ist ungültig.");
  }
  return { mode, teamId, quizId, sessionToken };
}
