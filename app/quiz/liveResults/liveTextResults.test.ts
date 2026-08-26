import assert from "node:assert/strict";
import test from "node:test";
import { aggregateLiveTextResults } from "./liveTextResults";

const submissions = [
  { submissionId: 1, teamId: 2, teamName: "Team A", avatarCode: "toaster", photoUrl: null, originalText: "P3nis", isVisible: true },
  { submissionId: 2, teamId: 3, teamName: "Team B", avatarCode: "lamp", photoUrl: null, originalText: "Harmlos", isVisible: false },
];

test("public state contains only explicitly approved sanitized text", () => {
  const state = aggregateLiveTextResults({ visible: true, state: "OPEN", totalTeams: 3, submissions, rules: [{ id: 1, searchTerm: "Penis", replacement: "Sonnenblume" }], includeModeration: false });
  assert.deepEqual(state.publicResponses, [{ submissionId: 1, publicText: "Sonnenblume" }]);
  assert.equal("moderationResponses" in state, false);
  assert.equal(JSON.stringify(state).includes("P3nis"), false);
});

test("moderation state preserves identity, original and sanitized diff", () => {
  const state = aggregateLiveTextResults({ visible: false, state: "CLOSED", totalTeams: 3, submissions, rules: [{ id: 1, searchTerm: "Penis", replacement: "Sonnenblume" }], includeModeration: true });
  assert.equal(state.moderationResponses?.[0]?.originalText, "P3nis");
  assert.equal(state.moderationResponses?.[0]?.publicText, "Sonnenblume");
  assert.equal(state.moderationResponses?.[0]?.changed, true);
});
