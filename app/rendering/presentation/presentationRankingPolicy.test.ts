import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowTeamIdentity } from "./presentationRankingPolicy";

test("public interim standings expose rank and points but never team identity", () => {
  assert.equal(shouldShowTeamIdentity({ standingsType: "INTERMEDIATE", renderMode: "PRESENTATION" }), false);
  assert.equal(shouldShowTeamIdentity({ standingsType: "INTERMEDIATE", renderMode: "MODERATION_PREVIEW" }), true);
});

test("final and winner slides intentionally reveal identity", () => {
  assert.equal(shouldShowTeamIdentity({ standingsType: "FINAL", renderMode: "PRESENTATION" }), true);
  assert.equal(shouldShowTeamIdentity({ standingsType: "WINNER", renderMode: "PRESENTATION" }), true);
});
