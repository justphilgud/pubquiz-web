import assert from "node:assert/strict";
import test from "node:test";
import { readPodiumSnapshot } from "./podiumSnapshot";
import { resolvePodiumReveal } from "@/app/rendering/presentation/presentationRankingPolicy";

test("persisted ceremony keeps tied rank groups and opens empty", () => {
  const scores = readPodiumSnapshot([
    { teamId: 1, teamname: "A very long winning team name", punkte: 10 },
    { teamId: 2, teamname: "Second", punkte: 8 },
    { teamId: 3, teamname: "Also second", punkte: 8 },
  ])!;
  assert.deepEqual(resolvePodiumReveal(scores, 0).visiblePodiumGroups, []);
  assert.deepEqual(resolvePodiumReveal(scores, 1).visiblePodiumGroups.map(group => group.place), [2]);
  assert.deepEqual(resolvePodiumReveal(scores, 2).visiblePodiumGroups.map(group => group.entries.length), [2, 1]);
  assert.equal(readPodiumSnapshot(null), null);
  assert.deepEqual(readPodiumSnapshot([]), []);
});
