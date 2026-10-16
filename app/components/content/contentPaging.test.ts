import assert from "node:assert/strict";
import test from "node:test";
import { collectContentWindow, compareContent, contentCreatedBoundary, readContentCursor, type ContentCursor, type ContentPosition } from "./contentPaging";
import { contentReturnHref, readContentResume } from "./contentNavigation";
import { getQuestionStatusesForContentFilter, parseContentFilters, serializeContentFilters } from "./contentLibrary";
import { questionSearchWhere } from "@/app/fragen/questionSearch";

test("187 mixed results: all pages, equal timestamps, overlapping IDs, no loss or duplicates", async () => {
  const rows: ContentPosition[] = Array.from({ length: 187 }, (_, n) => ({ id: Math.floor(n / 3) + 1, contentType: (["QUESTION", "POLL", "STORY_ELEMENT"] as const)[n % 3], createdAt: new Date(Date.UTC(2026, 9, 14, 0, 0, Math.floor(n / 7))).toISOString() }));
  const expected = [...rows].sort(compareContent);
  const received: ContentPosition[] = [];
  let cursor: ContentCursor | null = null;
  for (;;) {
    const windows = await Promise.all((["QUESTION", "POLL", "STORY_ELEMENT"] as const).map(async type => {
      const source = rows.filter(row => row.contentType === type).sort((a, b) => b.id - a.id);
      const window = await collectContentWindow(async beforeId => {
        const batch = source.filter(row => beforeId === null || row.id < beforeId).slice(0, 9);
        return { items: batch.map(row => ({ ...row, createdAt: new Date(row.createdAt) })), nextId: batch.length === 9 ? batch.at(-1)!.id : null };
      }, type, cursor);
      assert.equal(window.total, source.length);
      return window.items.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
    }));
    const page = windows.flat().sort(compareContent).slice(0, 50);
    if (!page.length) break;
    received.push(...page);
    cursor = readContentCursor(JSON.stringify({ ...page.at(-1), version: 1, signature: "same" }), "same");
  }
  assert.deepEqual(received, expected);
  assert.equal(new Set(received.map(row => `${row.contentType}:${row.id}`)).size, 187);
});

test("filtered empty batches do not terminate a source scan", async () => {
  const seen: (number | null)[] = [];
  const page = await collectContentWindow(async before => {
    seen.push(before);
    return before === null ? { items: [], nextId: 100 } : { items: [{ id: 99, createdAt: new Date("2026-10-01") }], nextId: null };
  }, "QUESTION", null);
  assert.equal(page.total, 1); assert.deepEqual(seen, [null, 100]);
});

test("cursor is bound to complete applied filters and rejects malformed positions", () => {
  const cursor = { version: 1, signature: "q=France", contentType: "QUESTION", createdAt: "2026-10-14T00:00:00.000Z", id: 8 };
  assert.throws(() => readContentCursor(JSON.stringify(cursor), "q=Italy"));
  for (const bad of ["bad", "null", JSON.stringify({ ...cursor, id: -1 }), JSON.stringify({ ...cursor, createdAt: "bad" })]) assert.throws(() => readContentCursor(bad, cursor.signature));
  assert.deepEqual(readContentCursor(JSON.stringify(cursor), cursor.signature), cursor);
  assert.ok(contentCreatedBoundary(cursor as ContentCursor, "QUESTION", "fragen_id").OR);
});

test("internal return URLs and anchor restore validate untrusted values", () => {
  for (const bad of ["//evil.test/content", "https://evil.test/content", "/content/../admin", "/content\\evil", "/api/secret"]) assert.equal(contentReturnHref(bad), "/content");
  assert.equal(contentReturnHref("/content?q=Italien&status=NOT_APPROVED"), "/content?q=Italien&status=NOT_APPROVED");
  assert.equal(readContentResume('{"pages":-1}'), null);
  assert.equal(readContentResume(JSON.stringify({ pages: 4, anchor: "QUESTION:8", index: 17, focus: "Bearbeiten", offset: -23 }))?.pages, 4);
});

test("not approved includes visible review states separately from personal drafts", () => {
  const filters = parseContentFilters(new URLSearchParams("status=NOT_APPROVED&q=Italien"));
  assert.deepEqual(getQuestionStatusesForContentFilter(filters.status), ["NOT_APPROVED"]);
  assert.deepEqual(getQuestionStatusesForContentFilter("DRAFT"), ["MY_DRAFTS"]);
  assert.equal(serializeContentFilters(filters).get("status"), "NOT_APPROVED");
});

test("search uses correct/accepted solutions and localized country codes without searching notes", () => {
  for (const query of ["Italien", "italien", "ITALIEN"]) assert.match(JSON.stringify(questionSearchWhere(query)), /"IT"/);
  assert.match(JSON.stringify(questionSearchWhere("Großbritannien")), /"GB"/);
  assert.match(JSON.stringify(questionSearchWhere("#123")), /"fragen_id":123/);
  const where = JSON.stringify(questionSearchWhere("Antwort"));
  assert.match(where, /ist_richtig.*true/); assert.match(where, /ist_akzeptiert.*true/);
  assert.doesNotMatch(where, /moderationsnotizen|review_feedback|template_config_json/);
});
