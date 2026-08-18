import { PUBLIC_CALENDAR_NAME } from "@/app/calendar/publicCalendar";

export const EVENT_CALENDAR_TIME_ZONE = "Europe/Berlin";

export type EventCalendarQuiz = {
  id: number;
  title: string;
  date: Date | string | null;
  time: string | null;
  venueName: string | null;
  publicUrl: string | null;
  isArchived: boolean;
};

export type EventCalendarSeries = {
  publicName: string | null;
  description: string | null;
  isPublic: boolean;
  isArchived: boolean;
  quizzes: EventCalendarQuiz[];
};

function escapeCalendarText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function formatUtcTimestamp(value: Date) {
  return value.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function parseCalendarDate(value: Date | string | null) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function formatCalendarDate(value: string) {
  return value.replaceAll("-", "");
}

function formatCalendarTime(value: string | null) {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return `${value.replace(":", "")}00`;
}

function foldCalendarLine(line: string) {
  const folded: string[] = [];
  let current = "";

  for (const character of line) {
    if (Buffer.byteLength(current + character, "utf8") > 75) {
      folded.push(current);
      current = ` ${character}`;
    } else {
      current += character;
    }
  }
  folded.push(current);
  return folded;
}

function serializeCalendar(lines: string[]) {
  return `${lines.flatMap(foldCalendarLine).join("\r\n")}\r\n`;
}

type CalendarEvent = {
  quiz: EventCalendarQuiz;
  date: string;
  description: string | null;
};

function normalizeCalendarEvents(
  series: EventCalendarSeries,
  today: string,
  description: string | null,
) {
  return series.quizzes
    .map((quiz) => ({ quiz, date: parseCalendarDate(quiz.date) }))
    .filter(
      (entry): entry is { quiz: EventCalendarQuiz; date: string } =>
        !entry.quiz.isArchived && entry.date !== null && entry.date >= today,
    )
    .map(({ quiz, date }) => ({ quiz, date, description }))
    .sort((left, right) => {
      const dateComparison = left.date.localeCompare(right.date);
      if (dateComparison !== 0) return dateComparison;
      const timeComparison = (left.quiz.time ?? "").localeCompare(right.quiz.time ?? "");
      return timeComparison !== 0 ? timeComparison : left.quiz.id - right.quiz.id;
    });
}

function buildCalendar(
  calendarName: string,
  events: CalendarEvent[],
  generatedAt: Date,
) {

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ungegoogelt//Eventreihen-Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeCalendarText(calendarName)}`,
    `X-WR-TIMEZONE:${EVENT_CALENDAR_TIME_ZONE}`,
    "BEGIN:VTIMEZONE",
    `TZID:${EVENT_CALENDAR_TIME_ZONE}`,
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const { quiz, date, description } of events) {
    const calendarDate = formatCalendarDate(date);
    const calendarTime = formatCalendarTime(quiz.time);
    lines.push(
      "BEGIN:VEVENT",
      `UID:quiz-${quiz.id}@pubquiz`,
      `DTSTAMP:${formatUtcTimestamp(generatedAt)}`,
      calendarTime
        ? `DTSTART;TZID=${EVENT_CALENDAR_TIME_ZONE}:${calendarDate}T${calendarTime}`
        : `DTSTART;VALUE=DATE:${calendarDate}`,
      `SUMMARY:${escapeCalendarText(quiz.title)}`,
    );
    if (quiz.venueName?.trim()) {
      lines.push(`LOCATION:${escapeCalendarText(quiz.venueName.trim())}`);
    }
    if (description?.trim()) {
      lines.push(`DESCRIPTION:${escapeCalendarText(description.trim())}`);
    }
    if (quiz.publicUrl?.trim()) {
      lines.push(`URL:${quiz.publicUrl.trim()}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return serializeCalendar(lines);
}

export function buildEventSeriesCalendar(
  series: EventCalendarSeries,
  today: string,
  generatedAt: Date,
) {
  if (!series.isPublic || series.isArchived) return null;

  return buildCalendar(
    series.publicName?.trim() || "Quizkalender",
    normalizeCalendarEvents(series, today, series.description),
    generatedAt,
  );
}

export function buildPublicQuizCalendar(
  series: readonly EventCalendarSeries[],
  today: string,
  generatedAt: Date,
  calendarName = PUBLIC_CALENDAR_NAME,
) {
  const events = series
    .filter((entry) => entry.isPublic && !entry.isArchived)
    .flatMap((entry) => {
      const publicName = entry.publicName?.trim();
      const description = entry.description?.trim();
      const publicDescription = [publicName, description]
        .filter(Boolean)
        .join("\n");
      return normalizeCalendarEvents(
        entry,
        today,
        publicDescription || null,
      );
    })
    .sort((left, right) => {
      const dateComparison = left.date.localeCompare(right.date);
      if (dateComparison !== 0) return dateComparison;
      const timeComparison = (left.quiz.time ?? "").localeCompare(
        right.quiz.time ?? "",
      );
      return timeComparison !== 0
        ? timeComparison
        : left.quiz.id - right.quiz.id;
    });

  return buildCalendar(calendarName, events, generatedAt);
}
