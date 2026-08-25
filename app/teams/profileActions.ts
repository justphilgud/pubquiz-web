"use server";

import {
  removeParticipantPhoto,
  updateParticipantAvatar,
} from "./teamProfile.server";

type ProfileActionResult =
  | { success: true; profile: Awaited<ReturnType<typeof updateParticipantAvatar>> }
  | { success: false; message: string };

function failure(error: unknown): ProfileActionResult {
  return { success: false, message: error instanceof Error ? error.message : "Das Teamprofil konnte nicht gespeichert werden." };
}

export async function chooseOwnTeamAvatar(data: { quizId: number; sessionToken: string; avatarCode: string }): Promise<ProfileActionResult> {
  try {
    return { success: true, profile: await updateParticipantAvatar(data.quizId, data.sessionToken, data.avatarCode) };
  } catch (error) {
    return failure(error);
  }
}

export async function removeOwnTeamPhoto(data: { quizId: number; sessionToken: string }): Promise<ProfileActionResult> {
  try {
    return { success: true, profile: await removeParticipantPhoto(data.quizId, data.sessionToken) };
  } catch (error) {
    return failure(error);
  }
}
