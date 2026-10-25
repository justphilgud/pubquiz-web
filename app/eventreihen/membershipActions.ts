"use server";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
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
  eventSeries: { id: number; name: string; archived: boolean }[];
  assignments: EventSeriesRoleAssignment[];
  managementAssignments?: { userId: number; eventSeriesId: number }[];
};

export type RoleAssignmentActionResult = {
  success: boolean;
  message: string;
};

export async function getRoleAssignmentOptions(): Promise<RoleAssignmentOptions> {
  await requireAdmin();
  const [users, eventSeries, assignments, management] = await Promise.all([
    prisma.users.findMany({
      where: { is_active: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.eventreihen.findMany({
      orderBy: { name: "asc" },
      select: { eventreihe_id: true, name: true, ist_archiviert: true },
    }),
    prisma.benutzer_reihenrollen.findMany({
      orderBy: [{ eventreihe: { name: "asc" } }, { benutzer: { name: "asc" } }],
      select: {

        eventreihe_id: true,
        benutzer_id: true,
        rolle: true,
        eventreihe: { select: { name: true, ist_archiviert: true } },
        benutzer: { select: { name: true, email: true } },
      },
    }),
    prisma.eventreihe_verwaltung.findMany({ select: { benutzer_id: true, eventreihe_id: true } }),
  ]);
  return {
    users,
    managementAssignments: management.map(m => ({ userId: m.benutzer_id, eventSeriesId: m.eventreihe_id })),
    eventSeries: eventSeries.map((series) => ({
      id: series.eventreihe_id,
      name: series.name,
      archived: series.ist_archiviert,
    })),
    assignments: assignments.flatMap((assignment, index) =>
      assignment.eventreihe_id !== null && isEventSeriesAssignmentRole(assignment.rolle)
        ? [{
            id: index + 1,
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

/** Retained action exports fail closed; the user form is authoritative. */
export async function addEventSeriesRoleAssignment(_input: { userId: number; eventSeriesId: number; role: string }): Promise<RoleAssignmentActionResult> {
  await requireAdmin();
  void _input;
  return { success: false, message: "Bitte die Reihenrollen direkt beim Benutzer bearbeiten." };
}
export async function changeEventSeriesRoleAssignment(_input: { assignmentId: number; role: string }): Promise<RoleAssignmentActionResult> {
  await requireAdmin();
  void _input;
  return { success: false, message: "Bitte die Reihenrollen direkt beim Benutzer bearbeiten." };
}
export async function removeEventSeriesRoleAssignment(_assignmentId: number): Promise<RoleAssignmentActionResult> {
  await requireAdmin();
  void _assignmentId;
  return { success: false, message: "Bitte die Reihenrollen direkt beim Benutzer bearbeiten." };
}
