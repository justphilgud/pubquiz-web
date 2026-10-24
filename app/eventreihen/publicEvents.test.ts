import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { berlinStart, parsePublicEventQuery, projectPublicEvents, type PublicSeriesSource } from "./publicEvents";
import { publicEventsResponse } from "./publicEventsHttp";
import { readPublicEventSeries } from "./publicEventsRepository";
import { buildPublicQuizCalendar } from "./eventCalendar";

const now = new Date("2026-10-24T20:00:00Z");
const quiz = { id: 11, title: "Quizabend", date: "2026-10-24", time: "19:00", venueName: "Café", mapUrl: "https://maps.example/11", publicUrl: "https://events.example/11", isArchived: false };
const fixtures: PublicSeriesSource[] = [
  { id: 1, slug: "lovd", publicName: "LOVD Quiz", description: "Öffentliche Beschreibung", logoUrl: "https://images.example/logo.png", isPublic: true, isArchived: false,
    quizzes: [quiz, { ...quiz, id: 12, date: "2026-10-23" }, { ...quiz, id: 13, date: null }, { ...quiz, id: 14, isArchived: true }] },
  { id: 2, slug: "bingo", publicName: "Bingo", description: null, logoUrl: null, isPublic: true, isArchived: false,
    quizzes: [{ ...quiz, id: 21, date: "2026-10-25", time: null }, { ...quiz, id: 22, date: "2026-11-01" }] },
  { id: 3, slug: "private", publicName: "Privat", description: "PRIVATE", logoUrl: "https://private.example/logo.png", isPublic: false, isArchived: false, quizzes: [{ ...quiz, id: 31 }] },
  { id: 4, slug: "archived", publicName: "Archiviert", description: null, logoUrl: null, isPublic: true, isArchived: true, quizzes: [{ ...quiz, id: 41 }] },
];
const options = { seriesIds: [], upcoming: true };

test("two public series, logo association, chronological events and exact public allowlist", () => {
  const result = projectPublicEvents(fixtures.map((s) => ({ ...s, internalNote: "SECRET", name: "INTERNAL" })), options, now);
  assert.deepEqual(result.series.map((s) => s.id), [1, 2]);
  assert.equal(result.series[0].logoUrl, "https://images.example/logo.png");
  assert.equal(result.series[1].logoUrl, null);
  assert.deepEqual(result.events.map((e) => [e.id, e.seriesId]), [[11, 1], [21, 2], [22, 2]]);
  assert.equal(result.events[0].startsAt, "2026-10-24T19:00:00+02:00");
  assert.equal(result.events[0].mapUrl, quiz.mapUrl);
  assert.equal(result.events[0].eventUrl, quiz.publicUrl);
  assert.equal(result.events[0].location, "Café");
  assert.equal(result.events[1].allDay, true);
  assert.equal(result.events[1].startsAt, null);
  assert.equal(result.events[2].startsAt, "2026-11-01T19:00:00+01:00");
  assert.doesNotMatch(JSON.stringify(result), /SECRET|INTERNAL|PRIVATE|private.example|Archiviert/);
});

test("multi-series filters fail closed and unknown/private IDs disclose nothing", () => {
  assert.deepEqual(parsePublicEventQuery(new URLSearchParams("series=1,2&series=2&upcoming=false")), { seriesIds: [1, 2], upcoming: false });
  for (const query of ["series=", "series=0", "series=1,foo", "series=-1", "series=1.5", "series=9007199254740992", "upcoming=yes", "upcoming=true&upcoming=false"]) {
    assert.throws(() => parsePublicEventQuery(new URLSearchParams(query)));
  }
  assert.throws(() => parsePublicEventQuery(new URLSearchParams(`series=${Array(51).fill(1).join(",")}`)));
  assert.deepEqual(projectPublicEvents(fixtures, { ...options, seriesIds: [3, 999] }, now).events, []);
  assert.deepEqual(projectPublicEvents(fixtures, { ...options, seriesIds: [2] }, now).series.map((s) => s.id), [2]);
  assert.deepEqual(projectPublicEvents(fixtures, { ...options, upcoming: false }, now).events.map((e) => e.id), [12, 11, 21, 22]);
});

test("events without end time survive the whole Berlin day, including DST days", () => {
  assert.ok(projectPublicEvents(fixtures, options, new Date("2026-10-24T21:59:59Z")).events.some((e) => e.id === 11));
  assert.ok(!projectPublicEvents(fixtures, options, new Date("2026-10-24T22:00:00Z")).events.some((e) => e.id === 11));
  assert.ok(projectPublicEvents(fixtures, options, new Date("2026-10-25T22:59:59Z")).events.some((e) => e.id === 21));
  assert.ok(!projectPublicEvents(fixtures, options, new Date("2026-10-25T23:00:00Z")).events.some((e) => e.id === 21));
  assert.equal(berlinStart("2026-03-29", "01:30"), "2026-03-29T01:30:00+01:00");
  assert.equal(berlinStart("2026-03-29", "03:30"), "2026-03-29T03:30:00+02:00");
  assert.equal(berlinStart("2026-03-29", "02:30"), null);
  assert.equal(berlinStart("2026-10-25", "02:30"), "2026-10-25T02:30:00+02:00");
});

test("repository applies public/active and series/date filters before projecting", async () => {
  await readPublicEventSeries({ findMany: async (args) => {
    assert.deepEqual(args.where, { ist_oeffentlich: true, ist_archiviert: false, eventreihe_id: { in: [1, 2] } });
    assert.equal(JSON.stringify(args.select).includes("interne_bemerkung"), false);
    assert.equal(JSON.stringify(args.select).includes('"name"'), false);
    assert.ok(JSON.stringify(args.select).includes('"gte":"2026-10-24T00:00:00.000Z"'));
    return [];
  } }, { seriesIds: [1, 2], upcoming: true }, now);
});

test("HTTP supports anonymous external reads, validation and conditional revalidation after withdrawal", async () => {
  let reads = 0;
  const read = async () => { reads++; return fixtures; };
  const first = await publicEventsResponse(new Request("https://quiz.example/api/public/events?series=1,2"), read, now);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(first.headers.get("Cache-Control")!, /must-revalidate/);
  const etag = first.headers.get("ETag")!;
  const unchanged = await publicEventsResponse(new Request("https://quiz.example/api/public/events?series=1,2", { headers: { "If-None-Match": etag } }), read, now);
  assert.equal(unchanged.status, 304);
  assert.equal(reads, 2);
  const withdrawn = await publicEventsResponse(new Request("https://quiz.example/api/public/events?series=1,2", { headers: { "If-None-Match": etag } }), async () => fixtures.map((s) => ({ ...s, isPublic: false })), now);
  assert.equal(withdrawn.status, 200);
  assert.deepEqual((await withdrawn.json()).events, []);
  const invalid = await publicEventsResponse(new Request("https://quiz.example/api/public/events?series=oops"), read, now);
  assert.equal(invalid.status, 400);
  assert.equal(reads, 2);
  assert.match(readFileSync("proxy.ts", "utf8"), /pathname === "\/api\/public\/events"/);
});

test("ICS preserves UIDs, public names and adds safely escaped series metadata", () => {
  const ics = buildPublicQuizCalendar(fixtures, "2026-10-24", now).replaceAll(/\r\n[ \t]/g, "");
  assert.match(ics, /UID:quiz-11@pubquiz/);
  assert.match(ics, /X-PHILGUD-SERIES-ID:1/);
  assert.match(ics, /X-PHILGUD-SERIES-NAME:LOVD Quiz/);
  assert.match(ics, /LOCATION:Café/);
  assert.doesNotMatch(ics, /SERIES-ID:[34]|PRIVATE|quiz-12@/);
  const special = buildPublicQuizCalendar([{ ...fixtures[0], publicName: "Name;\nInjected:yes" }], "2026-10-24", now);
  assert.match(special, /X-PHILGUD-SERIES-NAME:Name\\;\\nInjected:yes/);
});
