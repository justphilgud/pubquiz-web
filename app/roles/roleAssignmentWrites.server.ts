import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { isLastActiveRoleHolder } from "./roleAssignmentPolicy";
import { logRoleAudit } from "./roleAudit.server";

export type GlobalRole = "ADMIN" | "EDITOR";
export type EventSeriesRoleAssignmentInput = {
  eventSeriesId: number;
  role: "EDITOR" | "EVENT_MANAGER";
};

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

function legacyEventSeriesRole(role: EventSeriesRoleAssignmentInput["role"]) {
  return role === "EDITOR" ? ("EVENT_EDITOR" as const) : ("EVENT_MANAGER" as const);
}

export async function replaceEventSeriesRoleAssignments(
  transaction: Prisma.TransactionClient,
  input: {
    userId: number;
    assignments: readonly EventSeriesRoleAssignmentInput[];
    assignedById: number;
    verifyLegacy?: boolean;
  },
) {
  const requestedBySeries = new Map(
    input.assignments.map((assignment) => [assignment.eventSeriesId, assignment.role]),
  );
  if (requestedBySeries.size !== input.assignments.length) {
    throw new Error("Eine Eventreihe kann pro Benutzer nur einer Rolle zugeordnet werden.");
  }

  const [existingAssignments, legacyAssignments] = await Promise.all([
    transaction.benutzer_rollenzuweisungen.findMany({
      where: { benutzer_id: input.userId, scope_typ: "EVENT_SERIES" },
      select: {
        eventreihe_id: true,
        rolle: true,
        benutzer: { select: { is_active: true } },
        eventreihe: { select: { ist_archiviert: true } },
      },
    }),
    input.verifyLegacy
      ? transaction.eventreihe_benutzerrollen.findMany({
          where: { benutzer_id: input.userId },
          select: { eventreihe_id: true },
        })
      : Promise.resolve([]),
  ]);

  if (input.verifyLegacy) {
    const assignmentIds = new Set(
      existingAssignments.flatMap((assignment) =>
        assignment.eventreihe_id === null ? [] : [assignment.eventreihe_id],
      ),
    );
    const legacyIds = new Set(legacyAssignments.map((assignment) => assignment.eventreihe_id));
    const isConsistent =
      assignmentIds.size === legacyIds.size &&
      [...assignmentIds].every((eventSeriesId) => legacyIds.has(eventSeriesId));
    if (!isConsistent) {
      logRoleAudit("legacy_assignment_inconsistency", {
        userId: input.userId,
        scope: "EVENT_SERIES",
      });
      throw new Error("Legacy- und Rollenzuweisung sind inkonsistent. Es wurde nichts ge\u00e4ndert.");
    }
  }

  for (const existing of existingAssignments) {
    if (
      existing.eventreihe_id !== null &&
      existing.rolle === "EVENT_MANAGER" &&
      requestedBySeries.get(existing.eventreihe_id) !== "EVENT_MANAGER" &&
      existing.benutzer.is_active &&
      !existing.eventreihe?.ist_archiviert
    ) {
      const activeManagers = await transaction.benutzer_rollenzuweisungen.count({
        where: {
          scope_typ: "EVENT_SERIES",
          rolle: "EVENT_MANAGER",
          eventreihe_id: existing.eventreihe_id,
          benutzer: { is_active: true },
        },
      });
      if (isLastActiveRoleHolder(activeManagers)) {
        logRoleAudit("last_event_manager_protected", {
          userId: input.userId,
          eventSeriesId: existing.eventreihe_id,
        });
        throw new Error("Der letzte Eventmanager dieser Eventreihe kann nicht entfernt werden.");
      }
    }
  }

  await transaction.eventreihe_benutzerrollen.deleteMany({
    where: { benutzer_id: input.userId },
  });
  await transaction.benutzer_rollenzuweisungen.deleteMany({
    where: { benutzer_id: input.userId, scope_typ: "EVENT_SERIES" },
  });

  for (const assignment of input.assignments) {
    await transaction.benutzer_rollenzuweisungen.create({
      data: {
        benutzer_id: input.userId,
        eventreihe_id: assignment.eventSeriesId,
        rolle: assignment.role,
        scope_typ: "EVENT_SERIES",
        zugewiesen_von_user_id: input.assignedById,
      },
    });
    await transaction.eventreihe_benutzerrollen.create({
      data: {
        benutzer_id: input.userId,
        eventreihe_id: assignment.eventSeriesId,
        rolle: legacyEventSeriesRole(assignment.role),
        zugewiesen_von_user_id: input.assignedById,
      },
    });
  }
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
