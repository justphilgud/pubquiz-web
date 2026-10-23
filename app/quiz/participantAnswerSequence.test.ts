import assert from "node:assert/strict";
import test from "node:test";
import { insertActivatedStep } from "./participantAnswerSequence";

test("Meme voting follows intervening questions by activation, preserving normal order and reload identity", () => {
  const items = [{ id: "meme", at: "2026-10-23T18:00:00Z" }, { id: "normal", at: "2026-10-23T18:02:00Z" }, { id: "next", at: "2026-10-23T18:05:00Z" }];
  const build = () => insertActivatedStep(items, { id: "voting", at: "2026-10-23T18:04:00Z" }, "2026-10-23T18:04:00Z", item => item.at);
  assert.deepEqual(build().map(item => item.id), ["meme", "normal", "voting", "next"]);
  assert.deepEqual(JSON.parse(JSON.stringify(build())), build());
  assert.equal(build().filter(item => item.id === "voting").length, 1);
  assert.deepEqual(items.map(item => item.id), ["meme", "normal", "next"]);
});

import { buildParticipantAnswerSequence } from "./participantAnswerSequence";

const canonicalItems = [
  { kind: "QUESTION" as const, questionAssignmentId: 701 },
  { kind: "QUESTION" as const, questionAssignmentId: 702 },
  { kind: "LIVE_POLL" as const, placementId: 801 },
  { kind: "LIVE_POLL" as const, placementId: 802 },
];

test("released questions remain visible while the active poll keeps its configured position", () => {
  assert.deepEqual(
    buildParticipantAnswerSequence({
      canonicalItems,
      visibleQuestionIds: [701, 702],
      releasedPolls: [
        { runId: 901, placementId: 801, openedAt: "2026-10-02T08:00:00Z" },
      ],
    }),
    [
      { kind: "QUESTION", questionAssignmentId: 701 },
      { kind: "QUESTION", questionAssignmentId: 702 },
      { kind: "LIVE_POLL", runId: 901 },
    ],
  );
});

test("future polls stay hidden and closed released polls retain their own identity", () => {
  assert.deepEqual(
    buildParticipantAnswerSequence({
      canonicalItems,
      visibleQuestionIds: [701, 702],
      releasedPolls: [
        { runId: 901, placementId: 801, openedAt: "2026-10-02T08:00:00Z" },
      ],
    }),
    [
      { kind: "QUESTION", questionAssignmentId: 701 },
      { kind: "QUESTION", questionAssignmentId: 702 },
      { kind: "LIVE_POLL", runId: 901 },
    ],
  );
});

test("legacy items without a placement use deterministic release order", () => {
  assert.deepEqual(
    buildParticipantAnswerSequence({
      canonicalItems: [],
      visibleQuestionIds: [22, 21],
      releasedPolls: [
        { runId: 32, placementId: 302, openedAt: "2026-10-02T08:00:02Z" },
        { runId: 31, placementId: 301, openedAt: "2026-10-02T08:00:01Z" },
      ],
    }),
    [
      { kind: "QUESTION", questionAssignmentId: 22 },
      { kind: "QUESTION", questionAssignmentId: 21 },
      { kind: "LIVE_POLL", runId: 31 },
      { kind: "LIVE_POLL", runId: 32 },
    ],
  );
});

test("duplicate canonical placements cannot duplicate participant controls", () => {
  assert.deepEqual(
    buildParticipantAnswerSequence({
      canonicalItems: [
        ...canonicalItems,
        { kind: "QUESTION", questionAssignmentId: 701 },
        { kind: "LIVE_POLL", placementId: 801 },
      ],
      visibleQuestionIds: [701, 702],
      releasedPolls: [
        { runId: 901, placementId: 801, openedAt: null },
      ],
    }),
    [
      { kind: "QUESTION", questionAssignmentId: 701 },
      { kind: "QUESTION", questionAssignmentId: 702 },
      { kind: "LIVE_POLL", runId: 901 },
    ],
  );
});
