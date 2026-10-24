import "server-only";
import { getBerlinDate } from "@/app/lib/berlinDate";
import { prisma } from "@/app/lib/prisma";
import { PUBLIC_CALENDAR_NAME } from "@/app/calendar/publicCalendar";
import { buildEventSeriesCalendar, buildPublicQuizCalendar } from "./eventCalendar";
import { readPublicEventSeries } from "./publicEventsRepository";

export async function getPublicEventSeriesCalendar(eventSeriesId: number, now = new Date()) {
  if (!Number.isSafeInteger(eventSeriesId) || eventSeriesId <= 0) return null;
  const [series] = await readPublicEventSeries(prisma.eventreihen, { seriesIds: [eventSeriesId], upcoming: true }, now);
  if (!series) return null;
  return buildEventSeriesCalendar(series, getBerlinDate(now).toISOString().slice(0, 10), now);
}

export async function getPublicQuizCalendar(now = new Date(), seriesIds: readonly number[] = []) {
  const series = await readPublicEventSeries(prisma.eventreihen, { seriesIds, upcoming: true }, now);
  return buildPublicQuizCalendar(series, getBerlinDate(now).toISOString().slice(0, 10), now, PUBLIC_CALENDAR_NAME);
}
