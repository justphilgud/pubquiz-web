import { getBerlinDate } from "@/app/lib/berlinDate";
import { EVENT_CALENDAR_TIME_ZONE, type EventCalendarSeries } from "./eventCalendar";

export type PublicSeriesSource = EventCalendarSeries & {
  id: number;
  slug: string;
  logoUrl: string | null;
};

export function parsePublicEventQuery(params: URLSearchParams) {
  const raw = params.getAll("series").flatMap((value) => value.split(","));
  if (raw.length > 50 || raw.some((id) => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))) {
    throw new Error("series muss bis zu 50 positive numerische Reihenkennungen enthalten.");
  }
  const upcoming = params.get("upcoming") ?? "true";
  if (!["true", "false"].includes(upcoming) || params.getAll("upcoming").length > 1) {
    throw new Error("upcoming muss true oder false sein.");
  }
  return { seriesIds: [...new Set(raw.map(Number))], upcoming: upcoming === "true" };
}

export function publicHttpUrl(value: string | null | undefined) {
  if (!value || /[\r\n]/.test(value)) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// The DB stores a local date and wall-clock time, not a UTC instant.
// Match both Berlin offsets: choose the first occurrence during the autumn overlap.
// Nonexistent spring-forward wall-clock times are not invented.
export function berlinStart(date: string, time: string) {
  const local = `${date}T${time}:00`;
  const wall = Date.parse(`${local}Z`);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: EVENT_CALENDAR_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  for (const offset of [2, 1]) {
    const candidate = new Date(wall - offset * 3600000);
    if (!Number.isNaN(candidate.getTime()) && formatter.format(candidate).replace(" ", "T") === local) {
      return `${local}+0${offset}:00`;
    }
  }
  return null;
}

export function projectPublicEvents(
  input: readonly PublicSeriesSource[],
  options: { seriesIds: readonly number[]; upcoming: boolean },
  now = new Date(),
) {
  const today = getBerlinDate(now).toISOString().slice(0, 10);
  const visible = input.filter((series) => series.isPublic && !series.isArchived &&
    (!options.seriesIds.length || options.seriesIds.includes(series.id)));
  const series = visible.map((entry) => ({
    id: entry.id, slug: entry.slug, name: entry.publicName?.trim() || "Quizkalender",
    description: entry.description, logoUrl: publicHttpUrl(entry.logoUrl),
    calendarPath: `/calendar/event-series/${entry.id}.ics`,
  }));
  const events = visible.flatMap((entry) => entry.quizzes.flatMap((quiz) => {
    const date = quiz.date instanceof Date ? quiz.date.toISOString().slice(0, 10) : quiz.date;
    if (quiz.isArchived || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      (options.upcoming && date < today)) return [];
    const time = quiz.time && /^([01]\d|2[0-3]):[0-5]\d$/.test(quiz.time) ? quiz.time : null;
    const startsAt = time ? berlinStart(date, time) : null;
    if (time && !startsAt) return [];
    return [{
      id: quiz.id, seriesId: entry.id, title: quiz.title, date, time,
      timeZone: EVENT_CALENDAR_TIME_ZONE, startsAt, endsAt: null,
      allDay: time === null, location: quiz.venueName,
      mapUrl: publicHttpUrl(quiz.mapUrl), eventUrl: publicHttpUrl(quiz.publicUrl),
    }];
  })).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.id - b.id);
  return { version: 1, timeZone: EVENT_CALENDAR_TIME_ZONE, series, events };
}
