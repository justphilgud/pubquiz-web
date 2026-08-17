import "server-only";

import { getBerlinDate } from "@/app/lib/berlinDate";
import { prisma } from "@/app/lib/prisma";
import { buildEventSeriesCalendar } from "./eventCalendar";

export async function getPublicEventSeriesCalendar(
  eventSeriesId: number,
  now = new Date(),
) {
  if (!Number.isInteger(eventSeriesId) || eventSeriesId <= 0) return null;

  const today = getBerlinDate(now);
  const series = await prisma.eventreihen.findFirst({
    where: {
      eventreihe_id: eventSeriesId,
      ist_oeffentlich: true,
      ist_archiviert: false,
    },
    select: {
      oeffentlicher_name: true,
      beschreibung: true,
      ist_oeffentlich: true,
      ist_archiviert: true,
      quiz: {
        where: {
          ist_archiviert: false,
          quiz_datum: { gte: today },
        },
        orderBy: [
          { quiz_datum: "asc" },
          { veranstaltungszeit: "asc" },
          { quiz_id: "asc" },
        ],
        select: {
          quiz_id: true,
          titel: true,
          quiz_datum: true,
          veranstaltungszeit: true,
          veranstaltungsname: true,
          oeffentliche_url: true,
          ist_archiviert: true,
        },
      },
    },
  });

  if (!series) return null;

  return buildEventSeriesCalendar(
    {
      publicName: series.oeffentlicher_name,
      description: series.beschreibung,
      isPublic: series.ist_oeffentlich,
      isArchived: series.ist_archiviert,
      quizzes: series.quiz.map((quiz) => ({
        id: quiz.quiz_id,
        title: quiz.titel?.trim() || `Quiz ${quiz.quiz_id}`,
        date: quiz.quiz_datum,
        time: quiz.veranstaltungszeit,
        venueName: quiz.veranstaltungsname,
        publicUrl: quiz.oeffentliche_url,
        isArchived: quiz.ist_archiviert,
      })),
    },
    today.toISOString().slice(0, 10),
    now,
  );
}
