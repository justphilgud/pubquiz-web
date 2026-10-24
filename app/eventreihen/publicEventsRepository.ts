import type { Prisma } from "@/app/generated/prisma/client";
import { getBerlinDate } from "@/app/lib/berlinDate";
import type { PublicSeriesSource } from "./publicEvents";

// Explicit allowlist. Internal names, notes, users and quiz content never leave this query.
export const publicSeriesSelect = {
  eventreihe_id: true, slug: true, oeffentlicher_name: true, beschreibung: true,
  reservierungs_url: true,
  logo_url: true, ist_oeffentlich: true, ist_archiviert: true,
  quiz: { select: {
    reservierungs_url: true, veranstaltungsbild_url: true,
    oeffentliche_beschreibung: true, oeffentliche_beschreibung_modus: true,
    quiz_id: true, titel: true, quiz_datum: true, veranstaltungszeit: true,
    veranstaltungsname: true, karten_url: true, oeffentliche_url: true, ist_archiviert: true,
  } },
} as const satisfies Prisma.eventreihenSelect;

type Row = Prisma.eventreihenGetPayload<{ select: typeof publicSeriesSelect }>;
type PublicSelect = typeof publicSeriesSelect & { quiz: typeof publicSeriesSelect.quiz & { where?: Prisma.quizWhereInput; orderBy?: Prisma.quizOrderByWithRelationInput[] } };
type Repository = { findMany(args: Omit<Prisma.eventreihenFindManyArgs, "select" | "include"> & { select: PublicSelect }): Promise<Row[]> };

export async function readPublicEventSeries(
  repository: Repository,
  options: { seriesIds: readonly number[]; upcoming: boolean },
  now = new Date(),
): Promise<PublicSeriesSource[]> {
  const rows = await repository.findMany({
    where: { ist_oeffentlich: true, ist_archiviert: false,
      ...(options.seriesIds.length ? { eventreihe_id: { in: [...options.seriesIds] } } : {}),
    },
    orderBy: [{ oeffentlicher_name: "asc" }, { eventreihe_id: "asc" }],
    select: { ...publicSeriesSelect, quiz: { ...publicSeriesSelect.quiz,
      where: { ist_archiviert: false, quiz_datum: options.upcoming ? { gte: getBerlinDate(now) } : { not: null } },
      orderBy: [{ quiz_datum: "asc" }, { veranstaltungszeit: "asc" }, { quiz_id: "asc" }],
    } },
  });
  return rows.map((row) => ({
    id: row.eventreihe_id, slug: row.slug, publicName: row.oeffentlicher_name,
    reservationUrl: row.reservierungs_url,
    description: row.beschreibung, logoUrl: row.logo_url,
    isPublic: row.ist_oeffentlich, isArchived: row.ist_archiviert,
    quizzes: row.quiz.map((quiz) => ({
      reservationUrl: quiz.reservierungs_url, imageUrl: quiz.veranstaltungsbild_url,
      description: quiz.oeffentliche_beschreibung, descriptionMode: quiz.oeffentliche_beschreibung_modus,
      id: quiz.quiz_id, title: quiz.titel?.trim() || `Quiz ${quiz.quiz_id}`,
      date: quiz.quiz_datum, time: quiz.veranstaltungszeit, venueName: quiz.veranstaltungsname,
      mapUrl: quiz.karten_url, publicUrl: quiz.oeffentliche_url, isArchived: quiz.ist_archiviert,
    })),
  }));
}
