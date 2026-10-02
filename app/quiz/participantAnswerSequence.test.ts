import assert from "node:assert/strict";
import test from "node:test";

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
