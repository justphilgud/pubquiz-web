"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import {
  isEventSeriesAssignmentRole,
  removingAssignmentLeavesNoEventManager,
  type EventSeriesAssignmentRole,
} from "./eventSeriesAccessPolicy";
import { deRoleMessages } from "@/app/i18n/messages/de/roles";

export type EventSeriesMembership = {
  id: number;
  eventSeriesId: number;
  eventSeriesName: string;
  eventSeriesArchived: boolean;
  userId: number;
  userName: string | null;
  userEmail: string;
  role: EventSeriesAssignmentRole;
};

export type EventSeriesMembershipOptions = {
  users: { id: number; name: string | null; email: string }[];
  eventSeries: { id: number; name: string }[];
  memberships: EventSeriesMembership[];
};

export type MembershipActionResult = {
  success: boolean;
  message: string;
  requiresConfirmation?: boolean;
};

function revalidateMembershipPages(eventSeriesId: number) {
  revalidatePath("/admin/users");
  revalidatePath("/admin/eventreihen");
  revalidatePath(`/admin/eventreihen/${eventSeriesId}`);
}

export async function getEventSeriesMembershipOptions(): Promise<EventSeriesMembershipOptions> {
  await requireAdmin();
  const [users, eventSeries, memberships] = await Promise.all([
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
    prisma.eventreihe_benutzerrollen.findMany({
      orderBy: [{ eventreihe: { name: "asc" } }, { benutzer: { name: "asc" } }],
      select: {
        eventreihe_benutzerrolle_id: true,
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
    memberships: memberships.map((membership) => ({
      id: membership.eventreihe_benutzerrolle_id,
      eventSeriesId: membership.eventreihe_id,
      eventSeriesName: membership.eventreihe.name,
      eventSeriesArchived: membership.eventreihe.ist_archiviert,
      userId: membership.benutzer_id,
      userName: membership.benutzer.name,
      userEmail: membership.benutzer.email,
      role: membership.rolle as EventSeriesAssignmentRole,
    })),
  };
}

export async function addEventSeriesMembership(input: {
  userId: number;
  eventSeriesId: number;
  role: string;
}): Promise<MembershipActionResult> {
  const session = await requireAdmin();
  if (!Number.isInteger(input.userId) || !Number.isInteger(input.eventSeriesId) || !isEventSeriesAssignmentRole(input.role)) {
    return { success: false, message: "Ungültige Zuordnung." };
  }

  const [user, eventSeries] = await Promise.all([
    prisma.users.findFirst({ where: { id: input.userId, is_active: true }, select: { id: true } }),
    prisma.eventreihen.findFirst({
      where: { eventreihe_id: input.eventSeriesId, ist_archiviert: false },
      select: { eventreihe_id: true },
    }),
  ]);
  if (!user || !eventSeries) {
    return { success: false, message: "Aktiver Benutzer oder aktive Eventreihe nicht gefunden." };
  }

  const existing = await prisma.eventreihe_benutzerrollen.findUnique({
    where: { benutzer_id_eventreihe_id: { benutzer_id: input.userId, eventreihe_id: input.eventSeriesId } },
    select: { rolle: true },
  });
  if (existing) {
    return {
      success: false,
      message: deRoleMessages.messages.duplicateAssignment,
    };
  }

  const assignedBy = Number(session.user?.id);
  try {
    await prisma.eventreihe_benutzerrollen.create({
      data: {
        benutzer_id: input.userId,
        eventreihe_id: input.eventSeriesId,
        rolle: input.role,
        zugewiesen_von_user_id: Number.isInteger(assignedBy) ? assignedBy : null,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        message: deRoleMessages.messages.duplicateAssignment,
      };
    }
    throw error;
  }
  revalidateMembershipPages(input.eventSeriesId);
  return { success: true, message: deRoleMessages.messages.addSuccess };
}

export async function changeEventSeriesMembershipRole(input: {
  membershipId: number;
  role: string;
  confirmedWithoutManager?: boolean;
}): Promise<MembershipActionResult> {
  const session = await requireAdmin();
  if (
    !Number.isInteger(input.membershipId) ||
    input.membershipId <= 0 ||
    !isEventSeriesAssignmentRole(input.role)
  ) {
    return { success: false, message: "Ungültige Zuordnung." };
  }

  const existing = await prisma.eventreihe_benutzerrollen.findUnique({
    where: { eventreihe_benutzerrolle_id: input.membershipId },
    select: { eventreihe_id: true, rolle: true },
  });
  if (!existing) {
    return { success: false, message: "Zuordnung nicht gefunden." };
  }
  if (
    existing.rolle === "EVENT_MANAGER" &&
    input.role === "EVENT_EDITOR"
  ) {
    const managerCount = await prisma.eventreihe_benutzerrollen.count({
      where: { eventreihe_id: existing.eventreihe_id, rolle: "EVENT_MANAGER" },
    });
    if (managerCount <= 1 && !input.confirmedWithoutManager) {
      return {
        success: false,
        requiresConfirmation: true,
        message: deRoleMessages.messages.noManagerWarning,
      };
    }
  }

  const assignedBy = Number(session.user?.id);
  await prisma.eventreihe_benutzerrollen.update({
    where: { eventreihe_benutzerrolle_id: input.membershipId },
    data: {
      rolle: input.role,
      zugewiesen_von_user_id: Number.isInteger(assignedBy) ? assignedBy : null,
    },
  });
  revalidateMembershipPages(existing.eventreihe_id);
  return { success: true, message: deRoleMessages.messages.changeSuccess };
}

export async function removeEventSeriesMembership(
  membershipId: number,
  confirmedWithoutManager = false,
): Promise<MembershipActionResult> {
  await requireAdmin();
  if (!Number.isInteger(membershipId) || membershipId <= 0) {
    return { success: false, message: "Ungültige Zuordnung." };
  }

  const membership = await prisma.eventreihe_benutzerrollen.findUnique({
    where: { eventreihe_benutzerrolle_id: membershipId },
    select: { eventreihe_id: true, rolle: true },
  });
  if (!membership) return { success: false, message: "Zuordnung nicht gefunden." };

  const managers = await prisma.eventreihe_benutzerrollen.findMany({
    where: { eventreihe_id: membership.eventreihe_id, rolle: "EVENT_MANAGER" },
    select: { rolle: true },
  });
  const leavesNoManager = removingAssignmentLeavesNoEventManager(
    managers.map(() => ({ role: "EVENT_MANAGER" as const })),
    membership.rolle as EventSeriesAssignmentRole,
  );
  if (leavesNoManager && !confirmedWithoutManager) {
    return {
      success: false,
      requiresConfirmation: true,
      message: deRoleMessages.messages.noManagerWarning,
    };
  }

  await prisma.eventreihe_benutzerrollen.delete({
    where: { eventreihe_benutzerrolle_id: membershipId },
  });
  revalidateMembershipPages(membership.eventreihe_id);
  return { success: true, message: deRoleMessages.messages.removeSuccess };
}
