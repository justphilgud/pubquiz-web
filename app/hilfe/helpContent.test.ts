import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { getVisibleHelpTopics, helpTopics } from "./helpContent";

const actor = (assignments: Array<{ role: string; scopeType: string; eventSeriesId: number | null }>) => ({ userId: 1, assignments });

test("help topics are filtered by role", () => {
  const editorTopics = getVisibleHelpTopics(actor([{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }])).map((topic) => topic.slug);
  assert.ok(editorTopics.includes("fragen"));
  assert.ok(!editorTopics.includes("benutzer"));

  const eventManagerTopics = getVisibleHelpTopics(actor([{ role: "EVENT_MANAGER", scopeType: "EVENT_SERIES", eventSeriesId: 7 }])).map((topic) => topic.slug);
  assert.ok(eventManagerTopics.includes("moderation"));
  assert.ok(!eventManagerTopics.includes("benutzer"));

  const adminTopics = getVisibleHelpTopics(actor([{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }])).map((topic) => topic.slug);
  assert.ok(adminTopics.includes("benutzer"));
  assert.ok(adminTopics.includes("moderation"));
});

test("help screenshots reference the documented privacy-reviewed assets", () => {
  const screenshots = helpTopics.flatMap((topic) => topic.screenshots ?? []);
  assert.equal(screenshots.length, 4);
  for (const screenshot of screenshots) {
    assert.ok(existsSync(path.join(process.cwd(), "docs", "user-guide", "screenshots", screenshot.fileName)));
    assert.ok(screenshot.alt.length > 0);
    assert.ok(screenshot.caption.length > 0);
  }
});
