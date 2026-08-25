import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireActor } from "@/app/lib/permissions";
import { buildBlobPath } from "@/app/lib/blobPath";
import { getBlobUploadAuthentication, getMediaUploadEnvironmentPrefix } from "@/app/fragen/editor/mediaUploadEnvironment";
import { isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { assertTeamAccess } from "@/app/teams/teamManagement.server";
import { persistNormalizedTeamPhoto, requireParticipantTeamProfile } from "@/app/teams/teamProfile.server";
import { normalizeTeamPhoto, validateTeamPhotoFile } from "@/app/teams/teamPhotoProcessing";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: "Bitte ein Bild wählen." }, { status: 400 });
    validateTeamPhotoFile(file);

    const mode = String(formData.get("mode") ?? "TEAM");
    let teamId: number;
    if (mode === "ADMIN") {
      const { actor } = await requireActor();
      if (!isAdministrator(actor)) return NextResponse.json({ success: false, message: "Nur Administratoren dürfen Teamfotos hochladen." }, { status: 403 });
      teamId = Number(formData.get("teamId"));
      await assertTeamAccess(actor, teamId);
    } else {
      const quizId = Number(formData.get("quizId"));
      const token = String(formData.get("sessionToken") ?? "");
      const session = await requireParticipantTeamProfile(quizId, token);
      if (session.team.foto_upload_gesperrt) {
        return NextResponse.json({ success: false, message: "Foto-Uploads sind für dieses Team gesperrt. Ein Avatar kann weiterhin gewählt werden." }, { status: 403 });
      }
      teamId = session.team_id;
    }

    const normalized = await normalizeTeamPhoto(Buffer.from(await file.arrayBuffer()));
    const pathname = buildBlobPath(getMediaUploadEnvironmentPrefix(), "team-profile", [String(teamId), "profile.webp"]);
    const blob = await put(pathname, normalized, {
      ...getBlobUploadAuthentication(),
      access: "public",
      addRandomSuffix: true,
      contentType: "image/webp",
    });
    const profile = await persistNormalizedTeamPhoto(teamId, blob.url);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Teamfoto-Upload fehlgeschlagen", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, message: "Das Foto konnte nicht verarbeitet werden." }, { status: 400 });
  }
}
