import assert from "node:assert/strict";
import test from "node:test";
import { validateLivePollInput } from "./livePoll";
import { aggregateLivePollState, getLivePollPollingDelay } from "./livePollRuntime";

const base = {
  type: "SINGLE_CHOICE",
  prompt: "Was interessiert euch?",
  publicationMode: "AUTOMATIC",
  options: [{ id: "a", label: "KI" }, { id: "b", label: "Datenschutz" }],
  status: "ACTIVE",
  scope: "EVENT_SERIES",
  eventSeriesId: 7,
};

test("live polls validate independently from quiz answers", () => {
  const result = validateLivePollInput(base);
  assert.equal(result.ok, true);
  assert.equal(validateLivePollInput({ ...base, options: [{ id: "a", label: "Nur eine" }] }).ok, false);
  assert.equal(validateLivePollInput({ ...base, type: "FREE_TEXT", options: [] }).ok, true);
});

test("latest effective selection aggregates without team identity", () => {
  const result = aggregateLivePollState({
    revision: "1:3",
    runId: 1,
    state: "OPEN",
    config: { version: 1, pollId: 2, pollRevisionId: 3, type: "SINGLE_CHOICE", prompt: "Thema?", publicationMode: "AUTOMATIC", options: base.options },
    includeModeration: false,
    responses: [
      { id: 1, teamId: 10, teamName: "A", avatarCode: "toaster", photoUrl: null, selectedOptionId: "b", originalText: null, publicText: null, isVisible: false, updatedAt: "2026-08-28T08:00:00.000Z" },
      { id: 2, teamId: 11, teamName: "B", avatarCode: "toaster", photoUrl: null, selectedOptionId: "b", originalText: null, publicText: null, isVisible: false, updatedAt: "2026-08-28T08:00:01.000Z" },
    ],
  });
  assert.deepEqual(result.audience.options.map(({ id, count }) => ({ id, count })), [{ id: "a", count: 0 }, { id: "b", count: 2 }]);
  assert.equal("teamName" in result.audience, false);
  assert.equal(result.moderationResponses, undefined);
});

test("free text publishes only sanitized visible projections and caps the wall", () => {
  const responses = Array.from({ length: 25 }, (_, index) => ({
    id: index + 1,
    teamId: index + 1,
    teamName: `Team ${index + 1}`,
    avatarCode: "toaster" as const,
    photoUrl: null,
    selectedOptionId: null,
    originalText: index === 24 ? "P3nis" : `Original ${index + 1}`,
    publicText: index === 24 ? "Sonnenblume" : `Öffentlich ${index + 1}`,
    isVisible: true,
    updatedAt: new Date(Date.UTC(2026, 7, 28, 8, 0, index)).toISOString(),
  }));
  const result = aggregateLivePollState({
    revision: "1:25",
    runId: 1,
    state: "OPEN",
    config: { version: 1, pollId: 2, pollRevisionId: 3, type: "FREE_TEXT", prompt: "Wunsch?", publicationMode: "AUTOMATIC", options: [] },
    responses,
    includeModeration: true,
  });
  assert.equal(result.audience.publicResponses.length, 20);
  assert.equal(result.audience.publicResponses.at(-1)?.publicText, "Sonnenblume");
  assert.equal(JSON.stringify(result.audience).includes("P3nis"), false);
  assert.equal(result.moderationResponses?.at(-1)?.originalText, "P3nis");
});

test("polling is hidden-tab aware and backs off", () => {
  assert.equal(getLivePollPollingDelay({ hidden: false, consecutiveFailures: 0 }), 1_200);
  assert.equal(getLivePollPollingDelay({ hidden: true, consecutiveFailures: 0 }), 5_000);
  assert.equal(getLivePollPollingDelay({ hidden: false, consecutiveFailures: 4 }), 15_000);
});
