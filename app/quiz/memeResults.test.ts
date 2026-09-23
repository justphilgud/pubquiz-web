import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateMemeResult,
  getMemeResultPage,
  getMemeResultPageCount,
} from "./memeResults";

const candidates = [
  { candidateId: 11, number: 1, ownerTeamId: 101 },
  { candidateId: 12, number: 2, ownerTeamId: 102 },
  { candidateId: 13, number: 4, ownerTeamId: 103 },
];

test("AP4 counts final votes and awards exactly one point to the unique winner", () => {
  const result = calculateMemeResult({
    candidates,
    voteCandidateIds: [12, 12, 11, 12, 13],
  });
  assert.equal(result.totalVotes, 5);
  assert.equal(result.maximumVotes, 3);
  assert.deepEqual(result.winnerCandidateIds, [12]);
  assert.deepEqual(
    result.entries.map(({ number, voteCount, isWinner, awardedPoints }) => ({
      number,
      voteCount,
      isWinner,
      awardedPoints,
    })),
    [
      { number: 1, voteCount: 1, isWinner: false, awardedPoints: 0 },
      { number: 2, voteCount: 3, isWinner: true, awardedPoints: 1 },
      { number: 4, voteCount: 1, isWinner: false, awardedPoints: 0 },
    ],
  );
});

test("AP4 keeps every first-place tie winner and awards one point to each", () => {
  const result = calculateMemeResult({
    candidates,
    voteCandidateIds: [11, 12, 11, 12, 13],
  });
  assert.deepEqual(result.winnerCandidateIds, [11, 12]);
  assert.deepEqual(result.entries.map((entry) => entry.awardedPoints), [1, 1, 0]);
});

test("AP4 creates a stable no-winner result when no valid vote exists", () => {
  const result = calculateMemeResult({
    candidates: candidates.slice(0, 1),
    voteCandidateIds: [999],
  });
  assert.equal(result.totalVotes, 0);
  assert.equal(result.maximumVotes, 0);
  assert.deepEqual(result.winnerCandidateIds, []);
  assert.equal(result.entries[0]?.isWinner, false);
  assert.equal(result.entries[0]?.awardedPoints, 0);
});

test("AP4 awards the sole candidate only when a valid vote exists", () => {
  const result = calculateMemeResult({
    candidates: candidates.slice(0, 1),
    voteCandidateIds: [11],
  });
  assert.deepEqual(result.winnerCandidateIds, [11]);
  assert.equal(result.entries[0]?.voteCount, 1);
  assert.equal(result.entries[0]?.awardedPoints, 1);
});

test("AP4 result pages retain stable candidate order without an artificial limit", () => {
  const entries = Array.from({ length: 11 }, (_, index) => ({ number: index + 1 }));
  assert.equal(getMemeResultPageCount(1), 1);
  assert.equal(getMemeResultPageCount(2), 1);
  assert.equal(getMemeResultPageCount(4), 1);
  assert.equal(getMemeResultPageCount(8), 2);
  assert.equal(getMemeResultPageCount(11), 3);
  assert.deepEqual(getMemeResultPage(entries, 3).entries.map((entry) => entry.number), [9, 10, 11]);
});
