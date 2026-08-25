import assert from "node:assert/strict";
import test from "node:test";
import { rankScores, shouldShowTeamIdentity } from "./presentationRankingPolicy";

test("public interim standings expose rank and points but never team identity", () => {
  assert.equal(shouldShowTeamIdentity({ standingsType: "INTERMEDIATE", renderMode: "PRESENTATION" }), false);
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
