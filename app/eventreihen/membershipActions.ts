"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import { deRoleMessages } from "@/app/i18n/messages/de/roles";
import { logRoleAudit } from "@/app/roles/roleAudit.server";
import { withSerializableTransaction } from "@/app/roles/serializableTransaction.server";
import { isLastActiveRoleHolder } from "@/app/roles/roleAssignmentPolicy";
import {
  isEventSeriesAssignmentRole,
  type EventSeriesAssignmentRole,
} from "./eventSeriesAccessPolicy";

export type EventSeriesRoleAssignment = {
  id: number;
  eventSeriesId: number;
  eventSeriesName: string;
  eventSeriesArchived: boolean;
  userId: number;
  userName: string | null;
  userEmail: string;
  role: EventSeriesAssignmentRole;
};

export type RoleAssignmentOptions = {
  users: { id: number; name: string | null; email: string }[];
  eventSeries: { id: number; name: string }[];
  assignments: EventSeriesRoleAssignment[];
};

export type RoleAssignmentActionResult = {
  success: boolean;
  message: string;
};

function revalidateRolePages(eventSeriesId: number) {
  revalidatePath("/admin/users");
  revalidatePath("/admin/eventreihen");
  revalidatePath(`/admin/eventreihen/${eventSeriesId}`);
}

function legacyEventSeriesRole(role: EventSeriesAssignmentRole) {
  return role === "EDITOR" ? "EVENT_EDITOR" as const : "EVENT_MANAGER" as const;
}

function actorId(session: { user?: { id?: string } }) {
  const id = Number(session.user?.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Ungültige Anmeldung.");
  return id;
}

export async function getRoleAssignmentOptions(): Promise<RoleAssignmentOptions> {
  await requireAdmin();
  const [users, eventSeries, assignments] = await Promise.all([
    prisma.users.findMany({
      where: { is_active: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.eventreihen.findMany({
      where: { ist_archiviert: false },
      orderBy: { name: "asc" },
      select: { eventreihe_id: true, name: true },
    }),
    prisma.benutzer_rollenzuweisungen.findMany({
      where: { scope_typ: "EVENT_SERIES" },
      orderBy: [{ eventreihe: { name: "asc" } }, { benutzer: { name: "asc" } }],
      select: {
        rollenzuweisung_id: true,
        eventreihe_id: true,
        benutzer_id: true,
        rolle: true,
        eventreihe: { select: { name: true, ist_archiviert: true } },
        benutzer: { select: { name: true, email: true } },
      },
    }),
  ]);
  return {
    users,
    eventSeries: eventSeries.map((series) => ({ id: series.eventreihe_id, name: series.name })),
    assignments: assignments.flatMap((assignment) =>
      assignment.eventreihe_id !== null && isEventSeriesAssignmentRole(assignment.rolle)
        ? [{
            id: assignment.rollenzuweisung_id,
            eventSeriesId: assignment.eventreihe_id,
            eventSeriesName: assignment.eventreihe?.name ?? "",
            eventSeriesArchived: assignment.eventreihe?.ist_archiviert ?? false,
            userId: assignment.benutzer_id,
            userName: assignment.benutzer.name,
            userEmail: assignment.benutzer.email,
            role: assignment.rolle,
          }]
        : [],
    ),
  };
}

export async function addEventSeriesRoleAssignment(input: {
  userId: number;
  eventSeriesId: number;
  role: string;
}): Promise<RoleAssignmentActionResult> {
  const session = await requireAdmin();
  if (!Number.isInteger(input.userId) || !Number.isInteger(input.eventSeriesId) ||
    !isEventSeriesAssignmentRole(input.role)) {
    logRoleAudit("invalid_role_assignment_rejected", { scope: "EVENT_SERIES" });
    return { success: false, message: deRoleMessages.messages.invalidAssignment };
  }
  const role = input.role;
  const assignedById = actorId(session);
  try {
    const result = await withSerializableTransaction(async (transaction) => {
      const [user, eventSeries, assignment, legacy] = await Promise.all([
        transaction.users.findFirst({ where: { id: input.userId, is_active: true }, select: { id: true } }),
        transaction.eventreihen.findFirst({
          where: { eventreihe_id: input.eventSeriesId, ist_archiviert: false },
          select: { eventreihe_id: true },
        }),
        transaction.benutzer_rollenzuweisungen.findFirst({
          where: {
            benutzer_id: input.userId,
            eventreihe_id: input.eventSeriesId,
            scope_typ: "EVENT_SERIES",
          },
          select: { rollenzuweisung_id: true },
        }),
        transaction.eventreihe_benutzerrollen.findUnique({
          where: {
            benutzer_id_eventreihe_id: {
              benutzer_id: input.userId,
              eventreihe_id: input.eventSeriesId,
            },
          },
          select: { eventreihe_benutzerrolle_id: true },
        }),
      ]);
      if (!user || !eventSeries) return "missing" as const;
      if (Boolean(assignment) !== Boolean(legacy)) return "inconsistent" as const;
      if (assignment) return "duplicate" as const;
      await transaction.benutzer_rollenzuweisungen.create({
        data: {
          benutzer_id: input.userId,
          eventreihe_id: input.eventSeriesId,
          rolle: role,
          scope_typ: "EVENT_SERIES",
          zugewiesen_von_user_id: assignedById,
        },
      });
      await transaction.eventreihe_benutzerrollen.create({
        data: {
          benutzer_id: input.userId,
          eventreihe_id: input.eventSeriesId,
          rolle: legacyEventSeriesRole(role),
          zugewiesen_von_user_id: assignedById,
        },
      });
      return "created" as const;
    });
    if (result === "missing") return { success: false, message: deRoleMessages.messages.inactiveTarget };
    if (result === "duplicate") return { success: false, message: deRoleMessages.messages.duplicateAssignment };
    if (result === "inconsistent") {
      logRoleAudit("legacy_assignment_inconsistency", {
        userId: input.userId,
        eventSeriesId: input.eventSeriesId,
      });
      return { success: false, message: deRoleMessages.messages.inconsistentAssignment };
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { success: false, message: deRoleMessages.messages.duplicateAssignment };
    }
    throw error;
  }
  logRoleAudit("role_assignment_added", {
    userId: input.userId,
    eventSeriesId: input.eventSeriesId,
    role,
  });
  revalidateRolePages(input.eventSeriesId);
  return { success: true, message: deRoleMessages.messages.assignmentSaved };
}

async function activeManagerCount(
  transaction: Prisma.TransactionClient,
  eventSeriesId: number,
) {
  return transaction.benutzer_rollenzuweisungen.count({
    where: {
      eventreihe_id: eventSeriesId,
      scope_typ: "EVENT_SERIES",
      rolle: "EVENT_MANAGER",
      benutzer: { is_active: true },
    },
  });
}

export async function changeEventSeriesRoleAssignment(input: {
  assignmentId: number;
  role: string;
}): Promise<RoleAssignmentActionResult> {
  const session = await requireAdmin();
  if (!Number.isInteger(input.assignmentId) || input.assignmentId <= 0 ||
    !isEventSeriesAssignmentRole(input.role)) {
    return { success: false, message: deRoleMessages.messages.invalidAssignment };
  }
  const role = input.role;
  const assignedById = actorId(session);
  const result = await withSerializableTransaction(async (transaction) => {
    const existing = await transaction.benutzer_rollenzuweisungen.findUnique({
      where: { rollenzuweisung_id: input.assignmentId },
      select: {
        benutzer_id: true,
        eventreihe_id: true,
        rolle: true,
        benutzer: { select: { is_active: true } },
        eventreihe: { select: { ist_archiviert: true } },
      },
    });
    if (!existing || existing.eventreihe_id === null ||
      !isEventSeriesAssignmentRole(existing.rolle)) return { kind: "missing" as const };
    if (existing.rolle === role) {
      return { kind: "unchanged" as const, eventSeriesId: existing.eventreihe_id };
    }
    if (existing.rolle === "EVENT_MANAGER" && role === "EDITOR" &&
      existing.benutzer.is_active &&
      !existing.eventreihe?.ist_archiviert &&
      isLastActiveRoleHolder(await activeManagerCount(transaction, existing.eventreihe_id))) {
      return { kind: "lastManager" as const, eventSeriesId: existing.eventreihe_id };
    }
    const legacy = await transaction.eventreihe_benutzerrollen.updateMany({
      where: { benutzer_id: existing.benutzer_id, eventreihe_id: existing.eventreihe_id },
      data: { rolle: legacyEventSeriesRole(role), zugewiesen_von_user_id: assignedById },
    });
    if (legacy.count !== 1) return { kind: "inconsistent" as const, eventSeriesId: existing.eventreihe_id };
    await transaction.benutzer_rollenzuweisungen.update({
      where: { rollenzuweisung_id: input.assignmentId },
      data: { rolle: role, zugewiesen_von_user_id: assignedById },
    });
    return { kind: "changed" as const, eventSeriesId: existing.eventreihe_id };
  });
  if (result.kind === "missing") return { success: false, message: deRoleMessages.messages.assignmentNotFound };
  if (result.kind === "lastManager") {
    logRoleAudit("last_event_manager_protected", { eventSeriesId: result.eventSeriesId });
    return { success: false, message: deRoleMessages.messages.lastManagerProtected };
  }
  if (result.kind === "inconsistent") {
    logRoleAudit("legacy_assignment_inconsistency", { eventSeriesId: result.eventSeriesId });
    return { success: false, message: deRoleMessages.messages.inconsistentAssignment };
  }
  revalidateRolePages(result.eventSeriesId);
  if (result.kind === "changed") {
    logRoleAudit("role_assignment_changed", { eventSeriesId: result.eventSeriesId, role });
  }
  return { success: true, message: deRoleMessages.messages.assignmentSaved };
}

export async function removeEventSeriesRoleAssignment(
  assignmentId: number,
): Promise<RoleAssignmentActionResult> {
  await requireAdmin();
  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return { success: false, message: deRoleMessages.messages.invalidAssignment };
  }
  const result = await withSerializableTransaction(async (transaction) => {
    const assignment = await transaction.benutzer_rollenzuweisungen.findUnique({
      where: { rollenzuweisung_id: assignmentId },
      select: {
        benutzer_id: true,
        eventreihe_id: true,
        rolle: true,
        benutzer: { select: { is_active: true } },
        eventreihe: { select: { ist_archiviert: true } },
      },
    });
    if (!assignment || assignment.eventreihe_id === null ||
      !isEventSeriesAssignmentRole(assignment.rolle)) return { kind: "missing" as const };
    if (assignment.rolle === "EVENT_MANAGER" && assignment.benutzer.is_active &&
      !assignment.eventreihe?.ist_archiviert &&
      isLastActiveRoleHolder(await activeManagerCount(transaction, assignment.eventreihe_id))) {
      return { kind: "lastManager" as const, eventSeriesId: assignment.eventreihe_id };
    }
    const legacy = await transaction.eventreihe_benutzerrollen.deleteMany({
      where: { benutzer_id: assignment.benutzer_id, eventreihe_id: assignment.eventreihe_id },
    });
    if (legacy.count !== 1) return { kind: "inconsistent" as const, eventSeriesId: assignment.eventreihe_id };
    await transaction.benutzer_rollenzuweisungen.delete({ where: { rollenzuweisung_id: assignmentId } });
    return { kind: "removed" as const, eventSeriesId: assignment.eventreihe_id };
  });
  if (result.kind === "missing") return { success: false, message: deRoleMessages.messages.assignmentNotFound };
  if (result.kind === "lastManager") {
    logRoleAudit("last_event_manager_protected", { eventSeriesId: result.eventSeriesId });
    return { success: false, message: deRoleMessages.messages.lastManagerProtected };
  }
  if (result.kind === "inconsistent") {
    logRoleAudit("legacy_assignment_inconsistency", { eventSeriesId: result.eventSeriesId });
    return { success: false, message: deRoleMessages.messages.inconsistentAssignment };
  }
  logRoleAudit("role_assignment_removed", { eventSeriesId: result.eventSeriesId });
  revalidateRolePages(result.eventSeriesId);
  return { success: true, message: deRoleMessages.messages.assignmentRemoved };
}
