import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { isLastActiveRoleHolder } from "./roleAssignmentPolicy";
import { logRoleAudit } from "./roleAudit.server";

export type GlobalRole = "ADMIN" | "EDITOR";

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
      throw new Error("Legacy- und Rollenzuweisung sind inkonsistent. Es wurde nichts geändert.");
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
      throw new Error("Der letzte Administrator kann nicht entfernt werden.");
    }
  }
}

export async function assertCanDeactivateUser(
  transaction: Prisma.TransactionClient,
  userId: number,
) {
  await assertCanRemoveGlobalAdmin(transaction, userId);
  const managedActiveSeries = await transaction.benutzer_rollenzuweisungen.findMany({
    where: {
      benutzer_id: userId,
      scope_typ: "EVENT_SERIES",
      rolle: "EVENT_MANAGER",
      eventreihe: { ist_archiviert: false },
    },
    select: { eventreihe_id: true },
  });
  for (const assignment of managedActiveSeries) {
    const activeManagers = await transaction.benutzer_rollenzuweisungen.count({
      where: {
        scope_typ: "EVENT_SERIES",
        rolle: "EVENT_MANAGER",
        eventreihe_id: assignment.eventreihe_id,
        benutzer: { is_active: true },
      },
    });
    if (isLastActiveRoleHolder(activeManagers)) {
      logRoleAudit("last_event_manager_protected", {
        userId,
        eventSeriesId: assignment.eventreihe_id,
      });
      throw new Error("Der letzte Eventmanager dieser Eventreihe kann nicht entfernt werden.");
    }
  }
}
