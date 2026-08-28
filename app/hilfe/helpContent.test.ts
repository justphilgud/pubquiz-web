import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleHelpTopics } from "./helpContent";

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
