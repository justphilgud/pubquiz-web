import assert from "node:assert/strict";
import test from "node:test";
import { getBerlinDate } from "./berlinDate";

test("returns the calendar day in Europe/Berlin around the DST transition", () => {
  assert.equal(
    getBerlinDate(new Date("2026-03-28T22:30:00.000Z")).toISOString(),
    "2026-03-28T00:00:00.000Z",
  );
  assert.equal(
    getBerlinDate(new Date("2026-03-28T23:30:00.000Z")).toISOString(),
    "2026-03-29T00:00:00.000Z",
  );
});

test("uses the Berlin date rather than the server time zone", () => {
  assert.equal(
    getBerlinDate(new Date("2026-07-19T22:30:00.000Z")).toISOString(),
    "2026-07-20T00:00:00.000Z",
  );
});
