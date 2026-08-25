"use server";

import { revalidatePath } from "next/cache";
import { requireTeamManagementActor } from "./teamManagement.server";
import { removeManagedPhoto, setManagedPhotoUploadLock, updateManagedAvatar } from "./teamProfile.server";

type Result =
  | { success: true; profile: Awaited<ReturnType<typeof updateManagedAvatar>> }
  | { success: false; message: string };

function failure(error: unknown): Result {
  return { success: false, message: error instanceof Error ? error.message : "Das Teamprofil konnte nicht gespeichert werden." };
}

export async function chooseManagedTeamAvatar(data: { teamId: number; avatarCode: string }): Promise<Result> {
  try {
    const { actor } = await requireTeamManagementActor();
    const profile = await updateManagedAvatar(actor, data.teamId, data.avatarCode);
    revalidatePath(`/admin/teams/${data.teamId}`);
    return { success: true, profile };
  } catch (error) { return failure(error); }
}

export async function removeManagedTeamPhoto(data: { teamId: number }): Promise<Result> {
  try {
    const { actor } = await requireTeamManagementActor();
    const profile = await removeManagedPhoto(actor, data.teamId);
    revalidatePath(`/admin/teams/${data.teamId}`);
    return { success: true, profile };
  } catch (error) { return failure(error); }
}

export async function setManagedTeamPhotoUploadLock(data: { teamId: number; locked: boolean }): Promise<Result> {
  try {
    const { actor } = await requireTeamManagementActor();
    const profile = await setManagedPhotoUploadLock(actor, data.teamId, data.locked);
    revalidatePath(`/admin/teams/${data.teamId}`);
    return { success: true, profile };
  } catch (error) { return failure(error); }
}
