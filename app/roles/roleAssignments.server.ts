import type { Session } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import {
  isValidRoleAssignment,
  type AuthorizationActor,
  type RoleAssignmentSnapshot,
} from "./roleAssignmentPolicy";

export function sessionUserId(session: Session) {
  const userId = Number(session.user?.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Ungültige Anmeldung.");
  }
  return userId;
}

export async function getUserRoleAssignments(userId: number): Promise<RoleAssignmentSnapshot[]> {
  if (!Number.isInteger(userId) || userId <= 0) return [];
  const rows = await prisma.benutzer_rollenzuweisungen.findMany({
    where: { benutzer_id: userId, benutzer: { is_active: true } },
    select: {
      rollenzuweisung_id: true,
      rolle: true,
      scope_typ: true,
      eventreihe_id: true,
    },
  });
  const assignments = rows.map((row) => ({
    id: row.rollenzuweisung_id,
    role: row.rolle,
    scopeType: row.scope_typ,
    eventSeriesId: row.eventreihe_id,
  }));
  const invalid = assignments.filter((assignment) => !isValidRoleAssignment(assignment));
  if (invalid.length > 0) {
    console.warn("Ungültige Rollenzuweisung erkannt", {
      userId,
      assignmentIds: invalid.map((assignment) => assignment.id),
    });
  }
  return assignments;
}

export async function getActorPermissions(userId: number): Promise<AuthorizationActor> {
  return { userId, assignments: await getUserRoleAssignments(userId) };
}

export async function getActorForSession(session: Session): Promise<AuthorizationActor> {
  return getActorPermissions(sessionUserId(session));
}
