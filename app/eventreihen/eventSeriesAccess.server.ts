import "server-only";

import type { Session } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { requireActor, requireSession } from "@/app/lib/permissions";
import { getActorForSession } from "@/app/roles/roleAssignments.server";
import {
  getActorEventSeriesIds,
  isAdministrator,
  type AuthorizationActor,
} from "@/app/roles/roleAssignmentPolicy";
import {
  hasEventSeriesCapability,
  type EventSeriesAssignmentRole,
  type EventSeriesCapability,
} from "./eventSeriesAccessPolicy";

export type EventSeriesAssignment = {
  eventSeriesId: number;
  role: EventSeriesAssignmentRole;
};

export async function getCurrentEventSeriesAssignments(session?: Session) {
  const currentSession = session ?? await requireSession();
  const actor = await getActorForSession(currentSession);
  return actor.assignments.flatMap((assignment) =>
    assignment.scopeType === "EVENT_SERIES" &&
    assignment.eventSeriesId !== null &&
    (assignment.role === "EDITOR" || assignment.role === "EVENT_MANAGER")
      ? [{ eventSeriesId: assignment.eventSeriesId, role: assignment.role }]
      : [],
  );
}

export async function getEventSeriesIdsForCapability(
  capability: EventSeriesCapability,
  session?: Session,
) {
  const currentSession = session ?? await requireSession();
  const actor = await getActorForSession(currentSession);
  if (isAdministrator(actor)) return null;
  return getActorEventSeriesIds(actor).filter((eventSeriesId) =>
    hasEventSeriesCapability({ actor, eventSeriesId, capability }),
  );
}

export async function requireEventSeriesAccess(
  eventSeriesId: number,
  capability: EventSeriesCapability,
  authenticatedActor?: { session: Session; actor: AuthorizationActor },
) {
  const { session, actor } = authenticatedActor ?? await requireActor();
  if (!Number.isInteger(eventSeriesId) || eventSeriesId <= 0) {
    throw new Error("Eventreihe nicht gefunden oder Zugriff nicht erlaubt.");
  }
  const eventSeries = await prisma.eventreihen.findUnique({
    where: { eventreihe_id: eventSeriesId },
    select: { eventreihe_id: true, ist_archiviert: true },
  });
  if (!eventSeries || !hasEventSeriesCapability({ actor, eventSeriesId, capability })) {
    throw new Error("Eventreihe nicht gefunden oder Zugriff nicht erlaubt.");
  }
  return { session, actor, eventSeries, assignmentRole: getAssignmentRole(actor, eventSeriesId) };
}

function getAssignmentRole(actor: AuthorizationActor, eventSeriesId: number) {
  const assignment = actor.assignments.find((entry) =>
    entry.scopeType === "EVENT_SERIES" && entry.eventSeriesId === eventSeriesId,
  );
  return assignment?.role === "EDITOR" || assignment?.role === "EVENT_MANAGER"
    ? assignment.role
    : null;
}

export function requireEventSeriesViewer(eventSeriesId: number) {
  return requireEventSeriesAccess(eventSeriesId, "VIEW");
}

export function requireEventSeriesEditor(eventSeriesId: number) {
  return requireEventSeriesAccess(eventSeriesId, "EDIT");
}
