"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { logTeamAudit } from "./teamAudit.server";
import { normalizeTeamPassword, validateTeamPassword } from "./teamIdentity";
import {
  assertTeamAccess,
  requireTeamManagementActor,
  TeamManagementAccessError,
} from "./teamManagement.server";
import { deleteTeamInTransaction } from "./teamDeletion";
import type { TeamActionResult } from "./teamActionResult";

function parseTeamId(value: FormDataEntryValue | null) {
  const teamId = Number(value);
  if (!Number.isInteger(teamId) || teamId <= 0) throw new TeamManagementAccessError();
  return teamId;
}

function actionFailure(operation: string, error: unknown): TeamActionResult {
  if (error instanceof TeamManagementAccessError) {
    return { success: false, message: error.message };
  }
  console.error("Teamaktion fehlgeschlagen", {
    operation,
    errorName: error instanceof Error ? error.name : typeof error,
    errorCode: typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined,
  });
  return { success: false, message: "Die Teamaktion konnte nicht abgeschlossen werden." };
}

function revalidateTeam(teamId: number) {
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${teamId}`);
}

export async function setTeamPasswordAction(
  _previous: TeamActionResult,
  formData: FormData,
): Promise<TeamActionResult> {
  try {
    const { actor } = await requireTeamManagementActor();
    const teamId = parseTeamId(formData.get("teamId"));
    await assertTeamAccess(actor, teamId);
    const password = normalizeTeamPassword(String(formData.get("password") ?? ""));
    const validationError = validateTeamPassword(password);
    if (validationError) return { success: false, message: validationError };
    await prisma.teams.update({ where: { team_id: teamId }, data: { team_passwort: password } });
    logTeamAudit("team_password_changed", { actorUserId: actor.userId, teamId });
    revalidateTeam(teamId);
    return { success: true, message: "Team-Passwort wurde geändert." };
  } catch (error) {
    return actionFailure("set_password", error);
  }
}

async function requireAdminTeamActor() {
  const authenticated = await requireTeamManagementActor();
  if (!isAdministrator(authenticated.actor)) {
    throw new TeamManagementAccessError("Nur Administratoren dürfen globale Teams archivieren oder löschen.");
  }
  return authenticated.actor;
}

export async function archiveTeamAction(
  _previous: TeamActionResult,
  formData: FormData,
): Promise<TeamActionResult> {
  try {
    const actor = await requireAdminTeamActor();
    const teamId = parseTeamId(formData.get("teamId"));
    const result = await prisma.teams.updateMany({
      where: { team_id: teamId, ist_archiviert: false },
      data: { ist_archiviert: true, archiviert_am: new Date() },
    });
    if (result.count === 0) {
      const team = await assertTeamAccess(actor, teamId);
      return {
        success: false,
        message: team.ist_archiviert
          ? "Dieses Team ist bereits archiviert."
          : "Das Team konnte nicht archiviert werden.",
      };
    }
    logTeamAudit("team_archived", { actorUserId: actor.userId, teamId });
    revalidateTeam(teamId);
    return { success: true, message: "Team wurde archiviert." };
  } catch (error) {
    return actionFailure("archive", error);
  }
}

export async function reactivateTeamAction(
  _previous: TeamActionResult,
  formData: FormData,
): Promise<TeamActionResult> {
  try {
    const actor = await requireAdminTeamActor();
    const teamId = parseTeamId(formData.get("teamId"));
    const result = await prisma.teams.updateMany({
      where: { team_id: teamId, ist_archiviert: true },
      data: { ist_archiviert: false, archiviert_am: null },
    });
    if (result.count === 0) {
      const team = await assertTeamAccess(actor, teamId);
      return {
        success: false,
        message: team.ist_archiviert
          ? "Das Team konnte nicht reaktiviert werden."
          : "Dieses Team ist bereits aktiv.",
      };
    }
    logTeamAudit("team_reactivated", { actorUserId: actor.userId, teamId });
    revalidateTeam(teamId);
    return { success: true, message: "Team wurde reaktiviert." };
  } catch (error) {
    return actionFailure("reactivate", error);
  }
}

export async function deleteTeamAction(
  _previous: TeamActionResult,
  formData: FormData,
): Promise<TeamActionResult> {
  let redirectMode: "force" | "unused";
  try {
    const actor = await requireAdminTeamActor();
    const teamId = parseTeamId(formData.get("teamId"));
    const force = formData.get("force") === "true";
    const confirmation = String(formData.get("confirmation") ?? "").trim();
    const result = await prisma.$transaction((transaction) =>
      deleteTeamInTransaction(transaction, { teamId, force, confirmation }),
    );
    if (result.status === "not_found") throw new TeamManagementAccessError();
    if (result.status !== "deleted") {
      return { success: false, message: result.message };
    }
    logTeamAudit(force ? "team_force_deleted" : "team_deleted", {
      actorUserId: actor.userId,
      teamId,
      participationCount: result.participationCount,
    });
    revalidatePath("/admin/teams");
    redirectMode = force ? "force" : "unused";
  } catch (error) {
    return actionFailure("delete", error);
  }

  redirect(`/admin/teams?deleted=${redirectMode}`);
}
