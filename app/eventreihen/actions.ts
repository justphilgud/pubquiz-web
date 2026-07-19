"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import {
  generateUniqueEventSeriesSlug,
  eventSeriesArchiveState,
  validateEventSeriesInput,
  type EventSeriesInput,
} from "./eventSeriesPolicy";
import { getQuizTemporalStatus } from "@/app/quiz/quizMasterData";

export type EventSeriesOption = {
  id: number;
  name: string;
  isArchived: boolean;
};

export type EventSeriesListItem = EventSeriesOption & {
  slug: string;
  publicName: string | null;
  description: string | null;
  internalNote: string | null;
  isPublic: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  quizCount: number;
};

export type EventSeriesActionResult = {
  success: boolean;
  message: string;
  errors?: Record<string, string>;
  eventSeriesId?: number;
};

function toListItem(series: {
  eventreihe_id: number;
  name: string;
  slug: string;
  oeffentlicher_name: string | null;
  beschreibung: string | null;
  interne_bemerkung: string | null;
  ist_oeffentlich: boolean;
  ist_archiviert: boolean;
  archiviert_am: Date | null;
  created_at: Date;
  updated_at: Date;
  _count: { quiz: number };
}): EventSeriesListItem {
  return {
    id: series.eventreihe_id,
    name: series.name,
    slug: series.slug,
    publicName: series.oeffentlicher_name,
    description: series.beschreibung,
    internalNote: series.interne_bemerkung,
    isPublic: series.ist_oeffentlich,
    isArchived: series.ist_archiviert,
    archivedAt: series.archiviert_am?.toISOString() ?? null,
    createdAt: series.created_at.toISOString(),
    updatedAt: series.updated_at.toISOString(),
    quizCount: series._count.quiz,
  };
}

export async function getEventSeriesList(): Promise<EventSeriesListItem[]> {
  await requireAdmin();
  const series = await prisma.eventreihen.findMany({
    include: { _count: { select: { quiz: true } } },
    orderBy: [{ ist_archiviert: "asc" }, { name: "asc" }],
  });
  return series.map(toListItem);
}

export async function getEventSeriesOptions(
  includeArchived = false,
): Promise<EventSeriesOption[]> {
  await requireAdmin();
  const series = await prisma.eventreihen.findMany({
    where: includeArchived ? undefined : { ist_archiviert: false },
    orderBy: [{ ist_archiviert: "asc" }, { name: "asc" }],
    select: { eventreihe_id: true, name: true, ist_archiviert: true },
  });
  return series.map((entry) => ({
    id: entry.eventreihe_id,
    name: entry.name,
    isArchived: entry.ist_archiviert,
  }));
}

async function hasDuplicateName(name: string, exceptId?: number) {
  const duplicate = await prisma.eventreihen.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { eventreihe_id: { not: exceptId } } : {}),
    },
    select: { eventreihe_id: true },
  });
  return Boolean(duplicate);
}

export async function createEventSeries(
  input: EventSeriesInput,
): Promise<EventSeriesActionResult> {
  await requireAdmin();
  const validated = validateEventSeriesInput(input);
  if (!validated.ok) {
    return { success: false, message: "Bitte Eingaben prüfen.", errors: validated.errors };
  }
  if (await hasDuplicateName(validated.value.name)) {
    return {
      success: false,
      message: "Eine Eventreihe mit diesem Namen existiert bereits.",
      errors: { name: "Name ist bereits vergeben." },
    };
  }

  const slug = await generateUniqueEventSeriesSlug(
    validated.value.name,
    async (candidate) =>
      Boolean(
        await prisma.eventreihen.findUnique({
          where: { slug: candidate },
          select: { eventreihe_id: true },
        }),
      ),
  );
  const created = await prisma.eventreihen.create({
    data: {
      name: validated.value.name,
      slug,
      oeffentlicher_name: validated.value.publicName,
      beschreibung: validated.value.description,
      interne_bemerkung: validated.value.internalNote,
      ist_oeffentlich: validated.value.isPublic,
    },
    select: { eventreihe_id: true },
  });
  revalidatePath("/admin/eventreihen");
  revalidatePath("/quiz");
  return {
    success: true,
    message: "Eventreihe wurde angelegt.",
    eventSeriesId: created.eventreihe_id,
  };
}

export async function updateEventSeries(
  eventSeriesId: number,
  input: EventSeriesInput,
): Promise<EventSeriesActionResult> {
  await requireAdmin();
  if (!Number.isInteger(eventSeriesId) || eventSeriesId <= 0) {
    return { success: false, message: "Ungültige Eventreihe." };
  }
  const validated = validateEventSeriesInput(input);
  if (!validated.ok) {
    return { success: false, message: "Bitte Eingaben prüfen.", errors: validated.errors };
  }
  if (await hasDuplicateName(validated.value.name, eventSeriesId)) {
    return {
      success: false,
      message: "Eine Eventreihe mit diesem Namen existiert bereits.",
      errors: { name: "Name ist bereits vergeben." },
    };
  }
  const existing = await prisma.eventreihen.findUnique({
    where: { eventreihe_id: eventSeriesId },
    select: { eventreihe_id: true },
  });
  if (!existing) return { success: false, message: "Eventreihe nicht gefunden." };

  await prisma.eventreihen.update({
    where: { eventreihe_id: eventSeriesId },
    data: {
      name: validated.value.name,
      oeffentlicher_name: validated.value.publicName,
      beschreibung: validated.value.description,
      interne_bemerkung: validated.value.internalNote,
      ist_oeffentlich: validated.value.isPublic,
    },
  });
  revalidatePath("/admin/eventreihen");
  revalidatePath(`/admin/eventreihen/${eventSeriesId}`);
  revalidatePath("/quiz");
  return { success: true, message: "Eventreihe wurde aktualisiert." };
}

export async function archiveEventSeries(
  eventSeriesId: number,
): Promise<EventSeriesActionResult> {
  await requireAdmin();
  const result = await prisma.eventreihen.updateMany({
    where: { eventreihe_id: eventSeriesId, ist_archiviert: false },
    data: eventSeriesArchiveState(true),
  });
  if (result.count === 0) return { success: false, message: "Aktive Eventreihe nicht gefunden." };
  revalidatePath("/admin/eventreihen");
  revalidatePath(`/admin/eventreihen/${eventSeriesId}`);
  revalidatePath("/quiz");
  return { success: true, message: "Eventreihe wurde archiviert." };
}

export async function restoreEventSeries(
  eventSeriesId: number,
): Promise<EventSeriesActionResult> {
  await requireAdmin();
  const result = await prisma.eventreihen.updateMany({
    where: { eventreihe_id: eventSeriesId, ist_archiviert: true },
    data: eventSeriesArchiveState(false),
  });
  if (result.count === 0) return { success: false, message: "Archivierte Eventreihe nicht gefunden." };
  revalidatePath("/admin/eventreihen");
  revalidatePath(`/admin/eventreihen/${eventSeriesId}`);
  revalidatePath("/quiz");
  return { success: true, message: "Eventreihe wurde wiederhergestellt." };
}

export async function getEventSeriesDetails(eventSeriesId: number) {
  await requireAdmin();
  if (!Number.isInteger(eventSeriesId) || eventSeriesId <= 0) return null;
  const series = await prisma.eventreihen.findUnique({
    where: { eventreihe_id: eventSeriesId },
    include: {
      _count: { select: { quiz: true } },
      quiz: { orderBy: [{ quiz_datum: "desc" }, { quiz_id: "desc" }] },
    },
  });
  if (!series) return null;
  return {
    ...toListItem(series),
    quizzes: series.quiz.map((quiz) => ({
      id: quiz.quiz_id,
      title: quiz.titel?.trim() || `Quiz ${quiz.quiz_id}`,
      date: quiz.quiz_datum?.toISOString().slice(0, 10) ?? null,
      venueName: quiz.veranstaltungsname,
      status: getQuizTemporalStatus(quiz.quiz_datum, quiz.ist_archiviert),
    })),
  };
}
