import "server-only";

import type { Session } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { requireSession } from "@/app/lib/permissions";
import {
  hasEventSeriesCapability,
  type EventSeriesAssignmentRole,
  type EventSeriesCapability,
} from "./eventSeriesAccessPolicy";

export type EventSeriesAssignment = {
  eventSeriesId: number;
  role: EventSeriesAssignmentRole;
};

function sessionUserId(session: Session) {
  const userId = Number(session.user?.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Ungültige Anmeldung.");
  }
  return userId;
}

export async function getCurrentEventSeriesAssignments(session?: Session) {
  const currentSession = session ?? await requireSession();
  if (currentSession.user?.role === "ADMIN") return [];

  const assignments = await prisma.eventreihe_benutzerrollen.findMany({
    where: {
      benutzer_id: sessionUserId(currentSession),
      benutzer: { is_active: true },
    },
    select: { eventreihe_id: true, rolle: true },
  });

  return assignments.map((assignment) => ({
    eventSeriesId: assignment.eventreihe_id,
    role: assignment.rolle as EventSeriesAssignmentRole,
  }));
}

export async function getEventSeriesIdsForCapability(
  capability: EventSeriesCapability,
  session?: Session,
) {
  const currentSession = session ?? await requireSession();
  if (currentSession.user?.role === "ADMIN") return null;
  const assignments = await getCurrentEventSeriesAssignments(currentSession);
  return assignments
    .filter((assignment) => hasEventSeriesCapability({
      globalRole: currentSession.user?.role,
      assignmentRole: assignment.role,
      capability,
    }))
    .map((assignment) => assignment.eventSeriesId);
}

export async function requireEventSeriesAccess(
  eventSeriesId: number,
  capability: EventSeriesCapability,
) {
  const session = await requireSession();
  if (!Number.isInteger(eventSeriesId) || eventSeriesId <= 0) {
    throw new Error("Eventreihe nicht gefunden oder Zugriff nicht erlaubt.");
  }

  const eventSeries = await prisma.eventreihen.findUnique({
    where: { eventreihe_id: eventSeriesId },
    select: { eventreihe_id: true, ist_archiviert: true },
  });
  if (!eventSeries) {
    throw new Error("Eventreihe nicht gefunden oder Zugriff nicht erlaubt.");
  }

  let assignmentRole: EventSeriesAssignmentRole | null = null;
  if (session.user?.role !== "ADMIN") {
    const assignment = await prisma.eventreihe_benutzerrollen.findUnique({
      where: {
        benutzer_id_eventreihe_id: {
          benutzer_id: sessionUserId(session),
          eventreihe_id: eventSeriesId,
        },
      },
      select: { rolle: true },
    });
    assignmentRole = assignment?.rolle as EventSeriesAssignmentRole | undefined ?? null;
  }

  if (!hasEventSeriesCapability({
    globalRole: session.user?.role,
    assignmentRole,
    capability,
  })) {
    throw new Error("Eventreihe nicht gefunden oder Zugriff nicht erlaubt.");
  }

  return { session, eventSeries, assignmentRole };
}

export function requireEventSeriesViewer(eventSeriesId: number) {
  return requireEventSeriesAccess(eventSeriesId, "VIEW");
}

export function requireEventSeriesEditor(eventSeriesId: number) {
  return requireEventSeriesAccess(eventSeriesId, "EDIT");
}
