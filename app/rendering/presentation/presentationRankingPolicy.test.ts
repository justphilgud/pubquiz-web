import assert from "node:assert/strict";
import test from "node:test";
import {
  rankScores,
  resolveFinalStandingsReveal,
  shouldShowTeamIdentity,
} from "./presentationRankingPolicy";

test("public interim standings expose rank and points but never team identity", () => {
  assert.equal(shouldShowTeamIdentity({ standingsType: "INTERMEDIATE", renderMode: "PRESENTATION" }), false);
  assert.equal(shouldShowTeamIdentity({ standingsType: "INTERMEDIATE", renderMode: "DESIGN_PREVIEW" }), false);
  assert.equal(shouldShowTeamIdentity({ standingsType: "INTERMEDIATE", renderMode: "MODERATION_PREVIEW" }), true);
});

test("final and winner slides intentionally reveal identity", () => {
  assert.equal(shouldShowTeamIdentity({ standingsType: "FINAL", renderMode: "PRESENTATION" }), true);
  assert.equal(shouldShowTeamIdentity({ standingsType: "WINNER", renderMode: "PRESENTATION" }), true);
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

test("final reveal uses only existing podium groups before the full table", () => {
  const scores = [100, 90, 90, 80, 70].map((punkte, index) => ({
    team: `Team ${index + 1}`,
    punkte,
  }));

  const first = resolveFinalStandingsReveal(scores, 1);
  assert.deepEqual(first.podiumGroups.map((group) => group.place), [2, 1]);
  assert.deepEqual(first.visiblePodiumGroups.map((group) => group.place), [2]);
  assert.equal(first.showFullTable, false);
  assert.equal(first.revealStageCount, 3);

  const second = resolveFinalStandingsReveal(scores, 2);
  assert.deepEqual(second.visiblePodiumGroups.map((group) => group.place), [2, 1]);
  assert.equal(second.showFullTable, false);

  const full = resolveFinalStandingsReveal(scores, 3);
  assert.equal(full.showFullTable, true);
  assert.deepEqual(full.ranked.map((entry) => entry.place), [1, 2, 2, 4, 5]);
});
