import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuizCopyMasterData,
  getQuizTemporalStatus,
  resolveInitialEventSeriesId,
  validateQuizMasterData,
} from "./quizMasterData";

const validInput = {
  eventSeriesId: 7,
  title: "Sommerquiz",
  date: "2026-07-20",
  time: "19:30",
  venueName: "Café Paule",
  mapUrl: "https://maps.example/route",
  publicUrl: "https://events.example/quiz",
  internalNote: "intern",
};

test("quiz master data requires event series, title and a real calendar date", () => {
  assert.equal(validateQuizMasterData(validInput).ok, true);
  assert.equal(validateQuizMasterData({ ...validInput, eventSeriesId: 0 }).ok, false);
  assert.equal(validateQuizMasterData({ ...validInput, title: " " }).ok, false);
  assert.equal(validateQuizMasterData({ ...validInput, date: "" }).ok, false);
  assert.equal(validateQuizMasterData({ ...validInput, date: "2026-02-30" }).ok, false);
});

test("quiz creation preselects only the requested active event series", () => {
  const eventSeries = [
    { id: 7, isArchived: false },
    { id: 8, isArchived: true },
  ];
  assert.equal(resolveInitialEventSeriesId("7", eventSeries), 7);
  assert.equal(resolveInitialEventSeriesId("8", eventSeries), undefined);
  assert.equal(resolveInitialEventSeriesId("not-a-number", eventSeries), undefined);
});

test("quiz assignment accepts only explicitly authorized managed presentation templates", () => {
  const input = { ...validInput, presentationTemplateId: "sommer-2026" };
  assert.equal(validateQuizMasterData(input).ok, false);
  assert.equal(validateQuizMasterData(input, {
    additionalPresentationTemplateIds: ["sommer-2026"],
  }).ok, true);
});

test("quiz URLs allow only HTTP and HTTPS", () => {
  assert.equal(validateQuizMasterData({ ...validInput, mapUrl: "javascript:alert(1)" }).ok, false);
  assert.equal(validateQuizMasterData({ ...validInput, publicUrl: "ftp://example.test" }).ok, false);
  assert.equal(validateQuizMasterData({ ...validInput, mapUrl: "http://example.test" }).ok, true);
});

test("quiz time uses a strict local HH:MM value", () => {
  assert.equal(validateQuizMasterData({ ...validInput, time: "23:59" }).ok, true);
  assert.equal(validateQuizMasterData({ ...validInput, time: "24:00" }).ok, false);
});

test("quiz copy keeps its event series and location but never the public URL", () => {
  const copy = buildQuizCopyMasterData(
    { eventSeriesId: 4, time: "20:00", venueName: "Paule", mapUrl: "https://maps.example", internalNote: "note" },
    { title: "Kopie", date: "2026-08-01" },
  );
  assert.equal(copy.eventSeriesId, 4);
  assert.equal(copy.date, "2026-08-01");
  assert.equal(copy.venueName, "Paule");
  assert.equal(copy.publicUrl, undefined);
});

test("temporal status follows the Europe/Berlin calendar boundary", () => {
  const beforeBerlinMidnight = new Date("2026-07-19T21:59:59.000Z");
  const afterBerlinMidnight = new Date("2026-07-19T22:00:00.000Z");
  assert.equal(getQuizTemporalStatus("2026-07-19", false, beforeBerlinMidnight), "TODAY");
  assert.equal(getQuizTemporalStatus("2026-07-20", false, beforeBerlinMidnight), "UPCOMING");
  assert.equal(getQuizTemporalStatus("2026-07-19", false, afterBerlinMidnight), "PAST");
  assert.equal(getQuizTemporalStatus("2026-07-20", false, afterBerlinMidnight), "TODAY");
  assert.equal(getQuizTemporalStatus(null, false, afterBerlinMidnight), "MISSING_DATE");
  assert.equal(getQuizTemporalStatus("2099-01-01", true, afterBerlinMidnight), "ARCHIVED");
});
