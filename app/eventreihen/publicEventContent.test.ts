import assert from "node:assert/strict";
import test from "node:test";
import { resolvePublicEventContent, publicHttpUrl } from "./publicEventContent";
import { projectPublicEvents } from "./publicEvents";
import { publicEventsResponse } from "./publicEventsHttp";
import { validateEventSeriesInput } from "./eventSeriesPolicy";
import { validateQuizMasterData } from "@/app/quiz/quizMasterData";

const series = { reservationUrl: "https://example.org/book", logoUrl: "https://example.org/logo.png", description: "Reihe\n\nAbsatz 2" };
test("current standards, overrides and removing overrides are resolved dynamically", () => {
  const inherited = resolvePublicEventContent(series, {});
  assert.equal(inherited.imageUrl, series.logoUrl);
  assert.equal(inherited.reservationUrl, series.reservationUrl);
  const own = { imageUrl: "https://example.org/christmas.png", reservationUrl: "https://example.org/christmas" };
  const changed = { ...series, logoUrl: "https://example.org/new.png", reservationUrl: "https://example.org/new" };
  assert.equal(resolvePublicEventContent(changed, {}).imageUrl, changed.logoUrl);
  assert.equal(resolvePublicEventContent(changed, {}).reservationUrl, changed.reservationUrl);
  assert.equal(resolvePublicEventContent(changed, own).imageUrl, own.imageUrl);
  assert.equal(resolvePublicEventContent(changed, own).reservationUrl, own.reservationUrl);
  assert.equal(resolvePublicEventContent(changed, { imageUrl: null, reservationUrl: "  " }).imageUrl, changed.logoUrl);
  assert.equal(resolvePublicEventContent({}, {}).reservationUrl, null);
});
test("descriptions append with a paragraph, replace explicitly, and fall back on blank text", () => {
  assert.equal(resolvePublicEventContent(series, { description: " Christmas! " }).description, `${series.description}\n\nChristmas!`);
  assert.equal(resolvePublicEventContent(series, { description: "Christmas!", descriptionMode: "REPLACE" }).description, "Christmas!");
  for (const description of [null, "", " \n "]) for (const descriptionMode of ["APPEND", "REPLACE"]) {
    assert.equal(resolvePublicEventContent(series, { description, descriptionMode }).description, series.description);
  }
  assert.equal(resolvePublicEventContent({}, { description: "Quiz" }).description, "Quiz");
  assert.equal(resolvePublicEventContent({ description: " " }, { description: "\n" }).description, null);
});
test("reservation validation rejects unsafe URLs at both write boundaries", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "https://user:password@example.org", "https://example.org/\nattack"]) {
    assert.equal(publicHttpUrl(url), null);
    assert.equal(validateEventSeriesInput({ name: "QA", isPublic: true, reservationUrl: url }).ok, false);
    assert.equal(validateQuizMasterData({ eventSeriesId: 1, title: "QA", date: "2026-12-01", reservationUrl: url }).ok, false);
  }
  assert.equal(validateQuizMasterData({ eventSeriesId: 1, title: "QA", date: "2026-12-01", publicDescriptionMode: "BAD" }).ok, false);
});
test("effective API fields change ETag on series changes, exclude notes, and preserve IDs/links", async () => {
  const quiz = { id: 1, title: "QA", date: "2026-12-01", time: "19:00", venueName: "Ort", publicUrl: "https://example.org/event", mapUrl: "https://example.org/map", isArchived: false, internalNote: "QUIZ_SECRET" };
  let input = [{ ...series, id: 2, slug: "qa", publicName: "QA", isPublic: true, isArchived: false, internalNote: "SERIES_SECRET", quizzes: [quiz] }];
  const options = { seriesIds: [2], upcoming: true };
  const now = new Date("2026-10-24T12:00:00Z");
  const event = projectPublicEvents(input, options, now).events[0];
  assert.equal(event.reservationUrl, series.reservationUrl);
  assert.equal(event.imageUrl, series.logoUrl);
  assert.equal(event.description, series.description);
  assert.equal(event.eventUrl, quiz.publicUrl); assert.equal(event.mapUrl, quiz.mapUrl); assert.equal(event.id, 1);
  assert.doesNotMatch(JSON.stringify(event), /SECRET/);
  const req = new Request("https://example.org/api/public/events?series=2");
  const first = await publicEventsResponse(req, async () => input, now);
  input = [{ ...input[0], logoUrl: "https://example.org/new.png", description: "Neu" }];
  const second = await publicEventsResponse(new Request(req, { headers: { "If-None-Match": first.headers.get("ETag")! } }), async () => input, now);
  assert.equal(second.status, 200); assert.notEqual(second.headers.get("ETag"), first.headers.get("ETag"));
  input[0].isPublic = false;
  assert.deepEqual(projectPublicEvents(input, options, now).events, []);
});
