import { del, get, issueSignedToken, put } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getMediaUploadServerConfig } from "@/app/fragen/editor/mediaUploadEnvironment";
import { buildBlobPath } from "@/app/lib/blobPath";
import { requireActor } from "@/app/lib/permissions";
import { isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { assertTeamAccess } from "@/app/teams/teamManagement.server";
import { persistNormalizedTeamPhoto, requireParticipantTeamProfile } from "@/app/teams/teamProfile.server";
import { normalizeTeamPhoto } from "@/app/teams/teamPhotoProcessing";
import {
  ALLOWED_TEAM_PHOTO_TYPES,
  isAllowedTeamPhotoUploadPathname,
  MAX_TEAM_PHOTO_UPLOAD_BYTES,
  parseTeamPhotoUploadContext,
  type TeamPhotoUploadContext,
  validateTeamPhotoUpload,
} from "@/app/teams/teamPhotoUpload";

class TeamPhotoUploadError extends Error {
  constructor(public readonly publicMessage: string, public readonly status: number) {
    super(publicMessage);
    this.name = "TeamPhotoUploadError";
  }
}

async function authorizeUpload(context: TeamPhotoUploadContext) {
  if (context.mode === "ADMIN") {
    const { actor } = await requireActor();
    if (!isAdministrator(actor)) {
      throw new TeamPhotoUploadError("Nur Administratoren dürfen Teamfotos hochladen.", 403);
    }
    await assertTeamAccess(actor, context.teamId);
    return context.teamId;
  }

  const session = await requireParticipantTeamProfile(context.quizId, context.sessionToken);
  if (session.team_id !== context.teamId) {
    throw new TeamPhotoUploadError("Uploadkontext ist ungültig.", 403);
  }
  if (session.team.foto_upload_gesperrt) {
    throw new TeamPhotoUploadError(
      "Foto-Uploads sind für dieses Team gesperrt. Ein Avatar kann weiterhin gewählt werden.",
      403,
    );
  }
  return session.team_id;
}

async function finalizeUpload(body: Record<string, unknown>) {
  const context = parseTeamPhotoUploadContext(body.context);
  const teamId = await authorizeUpload(context);
  const blobUrl = body.blobUrl;
  if (typeof blobUrl !== "string" || !blobUrl.startsWith("https://")) {
    throw new TeamPhotoUploadError("Uploadreferenz ist ungültig.", 400);
  }

  const uploadConfig = getMediaUploadServerConfig();
  const source = await get(blobUrl, { ...uploadConfig.blobAuthentication, access: "public" });
  if (
    !source ||
    source.statusCode !== 200 ||
    !isAllowedTeamPhotoUploadPathname(source.blob.pathname, uploadConfig.environmentPrefix, teamId)
  ) {
    throw new TeamPhotoUploadError("Uploadreferenz ist ungültig.", 400);
  }
  validateTeamPhotoUpload({ size: source.blob.size, type: source.blob.contentType });

  let finalBlobUrl: string | null = null;
  try {
    const normalized = await normalizeTeamPhoto(Buffer.from(await new Response(source.stream).arrayBuffer()));
    const pathname = buildBlobPath(uploadConfig.environmentPrefix, "team-profile", [String(teamId), "profile.webp"]);
    const blob = await put(pathname, normalized, {
      ...uploadConfig.blobAuthentication,
      access: "public",
      addRandomSuffix: true,
      contentType: "image/webp",
    });
    finalBlobUrl = blob.url;
    const profile = await persistNormalizedTeamPhoto(teamId, blob.url);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    if (finalBlobUrl) await del(finalBlobUrl, uploadConfig.blobAuthentication).catch(() => undefined);
    throw error;
  } finally {
    await del(source.blob.url, uploadConfig.blobAuthentication).catch(() => undefined);
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && Reflect.get(body, "action") === "FINALIZE") {
      return await finalizeUpload(body as Record<string, unknown>);
    }

    const uploadConfig = getMediaUploadServerConfig();
    const jsonResponse = await handleUploadPresigned({
      body: body as HandleUploadPresignedBody,
      request,
      webhookPublicKey: uploadConfig.webhookPublicKey,
      getSignedToken: async (pathname, clientPayload) => {
        const context = parseTeamPhotoUploadContext(clientPayload ? JSON.parse(clientPayload) : null);
        const teamId = await authorizeUpload(context);
        if (!isAllowedTeamPhotoUploadPathname(pathname, uploadConfig.environmentPrefix, teamId)) {
          throw new TeamPhotoUploadError("Uploadpfad ist ungültig.", 400);
        }
        const validUntil = Date.now() + 10 * 60 * 1000;
        const token = await issueSignedToken({
          ...uploadConfig.blobAuthentication,
          pathname,
          operations: ["put"],
          allowedContentTypes: [...ALLOWED_TEAM_PHOTO_TYPES],
          maximumSizeInBytes: MAX_TEAM_PHOTO_UPLOAD_BYTES,
          validUntil,
        });
        return {
          token,
          urlOptions: {
            allowedContentTypes: [...ALLOWED_TEAM_PHOTO_TYPES],
            maximumSizeInBytes: MAX_TEAM_PHOTO_UPLOAD_BYTES,
            addRandomSuffix: true,
            validUntil,
          },
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Teamfoto-Upload fehlgeschlagen", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    const known = error instanceof TeamPhotoUploadError ? error : null;
    return NextResponse.json(
      { success: false, message: known?.publicMessage ?? "Das Foto konnte nicht verarbeitet werden." },
      { status: known?.status ?? 400 },
    );
  }
}
