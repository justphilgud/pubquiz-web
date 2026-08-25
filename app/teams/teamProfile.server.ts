import "server-only";

import { del } from "@vercel/blob";
import { prisma } from "@/app/lib/prisma";
import { getBlobAreaPrefix } from "@/app/lib/blobPath";
import { getMediaUploadEnvironmentPrefix, getBlobUploadAuthentication } from "@/app/fragen/editor/mediaUploadEnvironment";
import { resolveParticipantSession } from "@/app/quiz/participantSession.server";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { assertTeamAccess, TeamManagementAccessError } from "./teamManagement.server";
import { canManageTeamProfile } from "./teamManagementPolicy";
import { isTeamAvatarCode, mapTeamProfile, type TeamAvatarCode } from "./teamProfile";

export class TeamProfileAccessError extends Error {
  constructor(message = "Teamprofil nicht gefunden oder Zugriff nicht erlaubt.") {
    super(message);
    this.name = "TeamProfileAccessError";
  }
}

export async function requireParticipantTeamProfile(quizId: number, token: string) {
  const session = await resolveParticipantSession(quizId, token);
  if (!session || session.team.ist_archiviert) throw new TeamProfileAccessError();
  return session;
}

export async function updateParticipantAvatar(quizId: number, token: string, avatarCode: unknown) {
  if (!isTeamAvatarCode(avatarCode)) throw new TeamProfileAccessError("Bitte einen gültigen Avatar wählen.");
  const session = await requireParticipantTeamProfile(quizId, token);
  return updateAvatar(session.team_id, avatarCode);
}

export async function removeParticipantPhoto(quizId: number, token: string) {
  const session = await requireParticipantTeamProfile(quizId, token);
  return clearTeamPhoto(session.team_id);
}

export async function updateManagedAvatar(actor: AuthorizationActor, teamId: number, avatarCode: unknown) {
  if (!canManageTeamProfile(actor, "CHOOSE_AVATAR")) throw new TeamManagementAccessError("Nur Administratoren dürfen den Avatar eines Teams ändern.");
  await assertTeamAccess(actor, teamId);
  if (!isTeamAvatarCode(avatarCode)) throw new TeamManagementAccessError("Bitte einen gültigen Avatar wählen.");
  return updateAvatar(teamId, avatarCode);
}

export async function removeManagedPhoto(actor: AuthorizationActor, teamId: number) {
  if (!canManageTeamProfile(actor, "REMOVE_PHOTO")) throw new TeamManagementAccessError();
  await assertTeamAccess(actor, teamId);
  return clearTeamPhoto(teamId);
}

export async function setManagedPhotoUploadLock(actor: AuthorizationActor, teamId: number, locked: boolean) {
  if (!canManageTeamProfile(actor, "LOCK_PHOTO_UPLOAD")) throw new TeamManagementAccessError();
  await assertTeamAccess(actor, teamId);
  const team = await prisma.teams.update({
    where: { team_id: teamId },
    data: { foto_upload_gesperrt: locked },
    select: profileSelect,
  });
  return mapTeamProfile(team);
}

export async function updateAvatar(teamId: number, avatarCode: TeamAvatarCode) {
  const team = await prisma.teams.update({
    where: { team_id: teamId },
    data: { avatar_code: avatarCode },
    select: profileSelect,
  });
  return mapTeamProfile(team);
}

export async function persistNormalizedTeamPhoto(teamId: number, photoUrl: string) {
  const previous = await prisma.teams.findUniqueOrThrow({
    where: { team_id: teamId },
    select: { foto_url: true },
  });
  const team = await prisma.teams.update({
    where: { team_id: teamId },
    data: { foto_url: photoUrl },
    select: profileSelect,
  });
  if (previous.foto_url && previous.foto_url !== photoUrl) {
    await deleteUnreferencedTeamPhoto(previous.foto_url);
  }
  return mapTeamProfile(team);
}

export async function clearTeamPhoto(teamId: number) {
  const previous = await prisma.teams.findUniqueOrThrow({ where: { team_id: teamId }, select: { foto_url: true } });
  const team = await prisma.teams.update({ where: { team_id: teamId }, data: { foto_url: null }, select: profileSelect });
  if (previous.foto_url) await deleteUnreferencedTeamPhoto(previous.foto_url);
  return mapTeamProfile(team);
}

async function deleteUnreferencedTeamPhoto(url: string) {
  const expectedPrefix = `/${getBlobAreaPrefix(getMediaUploadEnvironmentPrefix(), "team-profile")}`;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return;
  }
  if (!pathname.startsWith(expectedPrefix)) return;
  const references = await prisma.teams.count({ where: { foto_url: url } });
  if (references > 0) return;
  try {
    await del(url, getBlobUploadAuthentication());
  } catch (error) {
    console.error("Verwaistes Teamfoto konnte nicht gelöscht werden", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
  }
}

export const profileSelect = {
  team_id: true,
  avatar_code: true,
  foto_url: true,
  foto_upload_gesperrt: true,
} as const;
