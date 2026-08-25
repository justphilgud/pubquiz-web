"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { logTeamAudit } from "./teamAudit.server";
import { normalizeTeamPassword, validateTeamPassword } from "./teamIdentity";
import {
  assertTeamAccess,
  requireTeamManagementActor,
  TeamManagementAccessError,
} from "./teamManagement.server";
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
  try {
    const actor = await requireAdminTeamActor();
    const teamId = parseTeamId(formData.get("teamId"));
    const force = formData.get("force") === "true";
    const confirmation = String(formData.get("confirmation") ?? "").trim();
    const team = await prisma.teams.findUnique({
      where: { team_id: teamId },
      select: {
        teamname: true,
        quiz_team_sessions: { select: { quiz_id: true } },
      },
    });
    if (!team) throw new TeamManagementAccessError();
    const participationCount = team.quiz_team_sessions.length;
    if (participationCount > 0 && !force) {
      return { success: false, message: "Dieses Team hat Quiz-Historie und kann nur archiviert werden." };
    }
    if (force && confirmation !== team.teamname) {
      return { success: false, message: "Bitte den Teamnamen exakt zur Bestätigung eingeben." };
    }

    const affectedQuizIds = [...new Set(team.quiz_team_sessions.map(({ quiz_id }) => quiz_id))];
    await prisma.$transaction(async (transaction) => {
      if (force) {
        await transaction.quiz_team_sessions.deleteMany({ where: { team_id: teamId } });
      }
      await transaction.quiz_teams.deleteMany({ where: { team_id: teamId } });
      await transaction.teams.delete({ where: { team_id: teamId } });
      for (const quizId of affectedQuizIds) {
        const statistics = await transaction.quiz_team_sessions.aggregate({
          where: { quiz_id: quizId },
          _count: { quiz_team_session_id: true },
          _sum: { spieler_anzahl: true },
        });
        await transaction.quiz.update({
          where: { quiz_id: quizId },
          data: {
            team_anzahl: statistics._count.quiz_team_session_id,
            teilnehmer_anzahl: statistics._sum.spieler_anzahl ?? 0,
          },
        });
      }
    });
    logTeamAudit(force ? "team_force_deleted" : "team_deleted", {
      actorUserId: actor.userId,
      teamId,
      participationCount,
    });
    revalidatePath("/admin/teams");
    return {
      success: true,
      message: force
        ? "Team und seine Quiz-Historie wurden endgültig gelöscht."
        : "Unbenutztes Team wurde gelöscht.",
      deleted: true,
    };
  } catch (error) {
    return actionFailure("delete", error);
  }
}
