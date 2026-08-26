import assert from "node:assert/strict";
import test from "node:test";
import {
  rankScores,
  resolveIntermediateStandingsAudience,
  resolveIntermediateStandingsModeration,
  resolvePodiumReveal,
} from "./presentationRankingPolicy";

test("public intermediate view models structurally discard team identity", () => {
  const scores = [
    {
      teamId: 17,
      teamname: "Geheimes Team",
      punkte: 42,
      photoUrl: "/secret.jpg",
      avatarCode: "teekanne",
    },
  ];

  const publicEntries = resolveIntermediateStandingsAudience(scores);
  assert.deepEqual(publicEntries, [
    {
      key: "anonymous-rank-1-0",
      place: 1,
      punkte: 42,
    },
  ]);
  assert.doesNotMatch(JSON.stringify(publicEntries), /Geheimes Team|secret\.jpg|teekanne/);

  const moderationEntries = resolveIntermediateStandingsModeration(scores);
  assert.equal(moderationEntries[0]?.identity.teamname, "Geheimes Team");
  assert.equal(moderationEntries[0]?.identity.photoUrl, "/secret.jpg");
});

test("ties use competition ranking without inventing the next place", () => {
  assert.deepEqual(
    rankScores([
      { team: "D", punkte: 40 },
      { team: "B", punkte: 70 },
      { team: "A", punkte: 90 },
      { team: "C", punkte: 70 },
    ]).map(({ team, punkte, place }) => ({ team, punkte, place })),
    [
      { team: "A", punkte: 90, place: 1 },
      { team: "B", punkte: 70, place: 2 },
      { team: "C", punkte: 70, place: 2 },
      { team: "D", punkte: 40, place: 4 },
    ],
  );
});

test("podium reveal uses only existing rank groups in ceremony order", () => {
  const scores = [100, 90, 90, 80, 70].map((punkte, index) => ({
    team: `Team ${index + 1}`,
    punkte,
  }));

  const first = resolvePodiumReveal(scores, 1);
  assert.deepEqual(first.podiumGroups.map((group) => group.place), [2, 1]);
  assert.deepEqual(first.visiblePodiumGroups.map((group) => group.place), [2]);
  assert.equal(first.revealStageCount, 2);

  const second = resolvePodiumReveal(scores, 2);
  assert.deepEqual(second.visiblePodiumGroups.map((group) => group.place), [2, 1]);
  assert.deepEqual(second.ranked.map((entry) => entry.place), [1, 2, 2, 4, 5]);
});
