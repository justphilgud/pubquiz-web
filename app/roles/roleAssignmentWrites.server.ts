import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { isLastActiveRoleHolder } from "./roleAssignmentPolicy";
import { logRoleAudit } from "./roleAudit.server";

export type GlobalRole = "ADMIN" | "EDITOR";
export type EventSeriesRoleAssignmentInput = {
  eventSeriesId: number;
  role: "EDITOR" | "EVENT_MANAGER";
};

export class RoleAssignmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleAssignmentValidationError";
  }
}

export function isGlobalRole(value: unknown): value is GlobalRole {
  return value === "ADMIN" || value === "EDITOR";
}

export function legacyRoleForGlobalRoles(roles: readonly GlobalRole[]) {
  if (roles.includes("ADMIN")) return "ADMIN" as const;
  if (roles.includes("EDITOR")) return "EDITOR" as const;
  return "USER" as const;
}

export async function replaceGlobalRoleAssignments(
  transaction: Prisma.TransactionClient,
  input: {
    userId: number;
    roles: readonly GlobalRole[];
    assignedById: number;
    verifyLegacy?: boolean;
  },
) {
  const roles = [...new Set(input.roles)];
  if (input.verifyLegacy) {
    const [user, existingAssignments] = await Promise.all([
      transaction.users.findUnique({ where: { id: input.userId }, select: { role: true } }),
      transaction.benutzer_rollenzuweisungen.findMany({
        where: { benutzer_id: input.userId, scope_typ: "GLOBAL" },
        select: { rolle: true },
      }),
    ]);
    const existingRoles = existingAssignments.flatMap(({ rolle }) =>
      rolle === "ADMIN" || rolle === "EDITOR" ? [rolle] : [],
    );
    if (user && user.role !== legacyRoleForGlobalRoles(existingRoles)) {
      logRoleAudit("legacy_assignment_inconsistency", { userId: input.userId, scope: "GLOBAL" });
      throw new RoleAssignmentValidationError(
        "Legacy- und Rollenzuweisung sind inkonsistent. Es wurde nichts geändert.",
      );
    }
  }
  await transaction.benutzer_rollenzuweisungen.deleteMany({
    where: {
      benutzer_id: input.userId,
      scope_typ: "GLOBAL",
      rolle: { notIn: roles.length > 0 ? roles : ["EVENT_MANAGER"] },
    },
  });
  for (const role of roles) {
    const existing = await transaction.benutzer_rollenzuweisungen.findFirst({
      where: { benutzer_id: input.userId, scope_typ: "GLOBAL", rolle: role },
      select: { rollenzuweisung_id: true },
    });
    if (!existing) {
      await transaction.benutzer_rollenzuweisungen.create({
        data: {
          benutzer_id: input.userId,
          rolle: role,
          scope_typ: "GLOBAL",
          eventreihe_id: null,
          zugewiesen_von_user_id: input.assignedById,
        },
      });
    }
  }
  await transaction.users.update({
    where: { id: input.userId },
    data: { role: legacyRoleForGlobalRoles(roles) },
  });
}

/** Obsolete pre-event-type writer: never update compatibility projections directly. */
export async function replaceEventSeriesRoleAssignments(
  _transaction: Prisma.TransactionClient,
  _input: { userId: number; assignments: readonly EventSeriesRoleAssignmentInput[]; assignedById: number; verifyLegacy?: boolean },
): Promise<never> {
  void _transaction; void _input;
  throw new RoleAssignmentValidationError("Bitte die Eventartrechte-Matrix verwenden.");
}

export async function assertCanRemoveGlobalAdmin(
  transaction: Prisma.TransactionClient,
  userId: number,
) {
  const globalAdmin = await transaction.benutzer_rollenzuweisungen.findFirst({
    where: { benutzer_id: userId, scope_typ: "GLOBAL", rolle: "ADMIN" },
    select: { rollenzuweisung_id: true },
  });
  if (globalAdmin) {
    const activeAdmins = await transaction.benutzer_rollenzuweisungen.count({
      where: {
        scope_typ: "GLOBAL",
        rolle: "ADMIN",
        benutzer: { is_active: true },
      },
    });
    if (isLastActiveRoleHolder(activeAdmins)) {
      logRoleAudit("last_admin_protected", { userId });
      throw new RoleAssignmentValidationError(
        "Der letzte Administrator kann nicht entfernt werden.",
      );
    }
  }
}

export async function assertCanDeactivateUser(
  transaction: Prisma.TransactionClient,
  userId: number,
) {
  await assertCanRemoveGlobalAdmin(transaction, userId);
}
