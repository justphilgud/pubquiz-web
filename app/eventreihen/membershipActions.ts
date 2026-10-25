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
};

export type RoleAssignmentActionResult = {
  success: boolean;
  message: string;
};

export async function getRoleAssignmentOptions(): Promise<RoleAssignmentOptions> {
  await requireAdmin();
  const [users, eventSeries, assignments] = await Promise.all([
    prisma.users.findMany({
      where: { is_active: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.eventreihen.findMany({
      orderBy: { name: "asc" },
      select: { eventreihe_id: true, name: true, ist_archiviert: true },
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
    eventSeries: eventSeries.map((series) => ({
      id: series.eventreihe_id,
      name: series.name,
      archived: series.ist_archiviert,
    })),
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

/** Retained action exports fail closed; the event type matrix is authoritative. */
export async function addEventSeriesRoleAssignment(_input: { userId: number; eventSeriesId: number; role: string }): Promise<RoleAssignmentActionResult> {
  await requireAdmin();
  void _input;
  return { success: false, message: "Bitte die Eventartrechte-Matrix verwenden." };
}
export async function changeEventSeriesRoleAssignment(_input: { assignmentId: number; role: string }): Promise<RoleAssignmentActionResult> {
  await requireAdmin();
  void _input;
  return { success: false, message: "Bitte die Eventartrechte-Matrix verwenden." };
}
export async function removeEventSeriesRoleAssignment(_assignmentId: number): Promise<RoleAssignmentActionResult> {
  await requireAdmin();
  void _assignmentId;
  return { success: false, message: "Bitte die Eventartrechte-Matrix verwenden." };
}
