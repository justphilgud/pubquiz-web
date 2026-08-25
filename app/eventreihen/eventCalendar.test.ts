import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildEventSeriesCalendar,
  buildPublicQuizCalendar,
  type EventCalendarSeries,
} from "./eventCalendar";
import {
  buildEventSeriesCalendarFeedPath,
  buildEventSeriesCalendarSubscriptionUrl,
  buildPublicCalendarSubscriptionUrl,
} from "@/app/calendar/publicCalendar";
import { resolveCalendarRequestOrigin } from "@/app/calendar/calendarOrigin";

const generatedAt = new Date("2026-08-17T10:11:12.000Z");

function createSeries(overrides: Partial<EventCalendarSeries> = {}): EventCalendarSeries {
  return {
    publicName: "Käpt'n Quiz & Gäste",
    description: "Ein Abend, zwei Runden; gute Laune.",
    isPublic: true,
    isArchived: false,
    quizzes: [
      {
        id: 41,
        title: "Frühling, Spaß & Wissen",
        date: "2026-10-25",
        time: "19:30",
        venueName: "Café Übermut; Saal 1",
        publicUrl: "https://example.test/events/41",
        isArchived: false,
      },
    ],
    ...overrides,
  };
}

function build(series = createSeries(), today = "2026-08-17") {
  return buildEventSeriesCalendar(series, today, generatedAt);
}

function unfold(calendar: string) {
  return calendar.replaceAll(/\r\n[ \t]/g, "");
}

function requestHeaders(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

test("public and event-series subscriptions use persistent webcal feeds", () => {
  assert.equal(
    buildPublicCalendarSubscriptionUrl("https://preview.quiz.example"),
    "webcal://preview.quiz.example/calendar/public.ics",
  );
  assert.equal(
    buildEventSeriesCalendarSubscriptionUrl("https://quiz.example", 42),
    "webcal://quiz.example/calendar/event-series/42.ics",
  );
  assert.equal(
    buildEventSeriesCalendarFeedPath(42),
    "/calendar/event-series/42.ics",
  );
  assert.throws(() => buildEventSeriesCalendarFeedPath(0));
});

test("request origin follows Preview, Production and local forwarded headers", () => {
  assert.equal(
    resolveCalendarRequestOrigin(requestHeaders({
      "x-forwarded-host": "preview-branch.vercel.app",
      "x-forwarded-proto": "https",
    })),
    "https://preview-branch.vercel.app",
  );
  assert.equal(
    resolveCalendarRequestOrigin(requestHeaders({ host: "quiz.example" })),
    "https://quiz.example",
  );
  assert.equal(
    resolveCalendarRequestOrigin(requestHeaders({ host: "localhost:3000" })),
    "http://localhost:3000",
  );
});

test("all calendar entry points expose direct subscription links", () => {
  const landing = readFileSync("app/kalender/page.tsx", "utf8");
  const renderer = readFileSync(
    "app/rendering/presentation/PresentationSlideRenderer.tsx",
    "utf8",
  );
  const answerPage = readFileSync(
    "app/quiz/[quizId]/antworten/page.tsx",
    "utf8",
  );
  const answerForm = readFileSync(
    "app/quiz/[quizId]/antworten/QuizAntwortClient.tsx",
    "utf8",
  );
  const teamProfileEditor = readFileSync(
    "app/teams/TeamProfileEditor.tsx",
    "utf8",
  );
  const eventSeries = readFileSync(
    "app/admin/eventreihen/[eventSeriesId]/page.tsx",
    "utf8",
  );
  const legacySubscribe = readFileSync(
    "app/calendar/subscribe/route.ts",
    "utf8",
  );

  assert.match(landing, /href=\{subscriptionUrl\}/);
  assert.match(
    renderer,
    /buildPublicCalendarSubscriptionUrl\(window\.location\.origin\)/,
  );
  assert.match(
    answerPage,
    /calendarSubscriptionUrl=\{buildPublicCalendarSubscriptionUrl/,
  );
  assert.match(answerForm, /calendarSubscriptionUrl=\{calendarSubscriptionUrl\}/);
  assert.match(teamProfileEditor, /href=\{calendarSubscriptionUrl\}/);
  assert.doesNotMatch(teamProfileEditor, /target="_blank"/);
  assert.match(eventSeries, /href=\{calendarSubscriptionUrl\}/);
  assert.match(legacySubscribe, /PUBLIC_CALENDAR_LANDING_PATH/);
  assert.doesNotMatch(legacySubscribe, /buildPublicCalendarSubscriptionUrl/);
});

test("creates a valid subscribable calendar with stable event identifiers", () => {
  const calendar = build();
  assert.ok(calendar);
  assert.match(calendar, /^BEGIN:VCALENDAR\r\n/);
  assert.match(calendar, /\r\nEND:VCALENDAR\r\n$/);
  assert.equal(calendar.replaceAll("\r\n", "").includes("\n"), false);
  assert.match(calendar, /BEGIN:VEVENT\r\nUID:quiz-41@pubquiz\r\n/);
  assert.match(calendar, /DTSTAMP:20260817T101112Z/);
  assert.match(calendar, /DTSTART;TZID=Europe\/Berlin:20261025T193000/);
  assert.match(calendar, /END:VEVENT/);

  const changed = build(createSeries({
    quizzes: [{ ...createSeries().quizzes[0], title: "Neuer Titel" }],
  }));
  assert.ok(changed);
  assert.match(changed, /UID:quiz-41@pubquiz/);
});

test("publishes only public, active event series", () => {
  assert.equal(build(createSeries({ isPublic: false })), null);
  assert.equal(build(createSeries({ isArchived: true })), null);
});

test("uses Berlin local time across daylight-saving dates", () => {
  const calendar = build(createSeries({
    quizzes: [
      { ...createSeries().quizzes[0], id: 1, date: "2026-03-29", time: "18:00" },
      { ...createSeries().quizzes[0], id: 2, date: "2026-10-25", time: "18:00" },
    ],
  }), "2026-01-01");
  assert.ok(calendar);
  assert.match(calendar, /BEGIN:VTIMEZONE/);
  assert.match(calendar, /TZID:Europe\/Berlin/);
  assert.match(calendar, /DTSTART;TZID=Europe\/Berlin:20260329T180000/);
  assert.match(calendar, /DTSTART;TZID=Europe\/Berlin:20261025T180000/);
});

test("escapes umlauts, commas, semicolons and line breaks", () => {
  const calendar = build();
  assert.ok(calendar);
  const unfolded = unfold(calendar);
  assert.match(unfolded, /X-WR-CALNAME:Käpt'n Quiz & Gäste/);
  assert.match(unfolded, /SUMMARY:Frühling\\, Spaß & Wissen/);
  assert.match(unfolded, /LOCATION:Café Übermut\\; Saal 1/);
  assert.match(unfolded, /DESCRIPTION:Ein Abend\\, zwei Runden\\; gute Laune\./);
});

test("supports missing optional fields and treats missing time as all-day", () => {
  const quiz = createSeries().quizzes[0];
  const calendar = build(createSeries({
    publicName: null,
    description: null,
    quizzes: [{ ...quiz, time: null, venueName: null, publicUrl: null }],
  }));
  assert.ok(calendar);
  assert.match(calendar, /X-WR-CALNAME:Quizkalender/);
  assert.match(calendar, /DTSTART;VALUE=DATE:20261025/);
  assert.doesNotMatch(calendar, /LOCATION:|DESCRIPTION:|URL:/);
});

test("excludes archived, past and undated quizzes and orders upcoming events", () => {
  const quiz = createSeries().quizzes[0];
  const calendar = build(createSeries({
    quizzes: [
      { ...quiz, id: 1, title: "Past", date: "2026-08-16" },
      { ...quiz, id: 2, title: "Archived", isArchived: true },
      { ...quiz, id: 3, title: "Undated", date: null },
      { ...quiz, id: 5, title: "Later", date: "2026-12-01" },
      { ...quiz, id: 4, title: "Sooner", date: "2026-09-01" },
    ],
  }));
  assert.ok(calendar);
  assert.doesNotMatch(calendar, /SUMMARY:(Past|Archived|Undated)/);
  assert.ok(calendar.indexOf("SUMMARY:Sooner") < calendar.indexOf("SUMMARY:Later"));
});

test("folds every physical content line at 75 UTF-8 bytes", () => {
  const quiz = createSeries().quizzes[0];
  const calendar = build(createSeries({
    quizzes: [{ ...quiz, title: "Überraschung ".repeat(20) }],
  }));
  assert.ok(calendar);
  for (const line of calendar.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `${Buffer.byteLength(line, "utf8")}: ${line}`);
  }
  assert.match(unfold(calendar), /SUMMARY:(Überraschung ){20}/);
});

test("general calendar aggregates only public active series and eligible quizzes", () => {
  const publicSeries = createSeries({
    publicName: "Öffentliche Reihe",
    quizzes: [
      { ...createSeries().quizzes[0], id: 51, title: "Öffentlicher Termin" },
      { ...createSeries().quizzes[0], id: 52, title: "Archiviert", isArchived: true },
      { ...createSeries().quizzes[0], id: 53, title: "Vergangen", date: "2026-08-16" },
    ],
  });
  const calendar = buildPublicQuizCalendar(
    [
      publicSeries,
      createSeries({
        publicName: "Private Firmenreihe",
        isPublic: false,
        quizzes: [{ ...createSeries().quizzes[0], id: 54, title: "Firmenquiz" }],
      }),
      createSeries({
        publicName: "Archivierte Reihe",
        isArchived: true,
        quizzes: [{ ...createSeries().quizzes[0], id: 55, title: "Altbestand" }],
      }),
    ],
    "2026-08-17",
    generatedAt,
  );

  const unfolded = unfold(calendar);
  assert.match(unfolded, /X-WR-CALNAME:ungegoogelt PubQuiz-Termine/);
  assert.match(unfolded, /SUMMARY:Öffentlicher Termin/);
  assert.match(unfolded, /DESCRIPTION:Öffentliche Reihe/);
  assert.doesNotMatch(unfolded, /Archiviert|Vergangen|Firmenquiz|Altbestand|Private Firmenreihe/);
});

test("the same public feed includes later additions and changed appointments", () => {
  const quiz = createSeries().quizzes[0];
  const firstFetch = buildPublicQuizCalendar(
    [createSeries({ quizzes: [{ ...quiz, id: 71, title: "Termin A" }] })],
    "2026-08-17",
    generatedAt,
  );
  const secondFetch = buildPublicQuizCalendar(
    [createSeries({
      quizzes: [
        { ...quiz, id: 71, title: "Termin A aktualisiert", time: "20:00" },
        { ...quiz, id: 72, title: "Termin B", date: "2026-11-01" },
      ],
    })],
    "2026-08-17",
    generatedAt,
  );

  assert.match(firstFetch, /UID:quiz-71@pubquiz/);
  assert.doesNotMatch(firstFetch, /Termin B/);
  assert.match(secondFetch, /UID:quiz-71@pubquiz/);
  assert.match(secondFetch, /SUMMARY:Termin A aktualisiert/);
  assert.match(secondFetch, /DTSTART;TZID=Europe\/Berlin:20261025T200000/);
  assert.match(secondFetch, /UID:quiz-72@pubquiz/);
  assert.match(secondFetch, /SUMMARY:Termin B/);
});

test("changing a series from public to private removes it from the same feed", () => {
  const publicFetch = buildPublicQuizCalendar(
    [createSeries({ isPublic: true })],
    "2026-08-17",
    generatedAt,
  );
  const privateFetch = buildPublicQuizCalendar(
    [createSeries({ isPublic: false })],
    "2026-08-17",
    generatedAt,
  );

  assert.match(publicFetch, /UID:quiz-41@pubquiz/);
  assert.doesNotMatch(privateFetch, /UID:quiz-41@pubquiz/);
});

test("calendar routes keep persistent public feed endpoints", () => {
  const constants = readFileSync("app/calendar/publicCalendar.ts", "utf8");
  const proxy = readFileSync("proxy.ts", "utf8");

  assert.match(constants, /PUBLIC_CALENDAR_LANDING_PATH = "\/kalender"/);
  assert.match(constants, /PUBLIC_CALENDAR_FEED_PATH = "\/calendar\/public\.ics"/);
  assert.match(constants, /PUBLIC_CALENDAR_SUBSCRIBE_PATH = "\/calendar\/subscribe"/);
  assert.equal(
    buildPublicCalendarSubscriptionUrl("https://quiz.example"),
    "webcal://quiz.example/calendar/public.ics",
  );
  assert.match(proxy, /"\/kalender"/);
  assert.match(proxy, /"\/calendar\/subscribe"/);
});
