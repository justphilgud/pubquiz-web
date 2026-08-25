import assert from "node:assert/strict";
import test from "node:test";
import { shouldOpenTeamProfileOnboarding } from "./teamProfileOnboarding";

test("new global teams enter the profile onboarding flow", () => {
  assert.equal(
    shouldOpenTeamProfileOnboarding({
      teamWasCreated: true,
      teamAlreadyJoinedQuiz: false,
    }),
    true,
  );
});

test("an existing team sees profile onboarding on its first join to a quiz", () => {
  assert.equal(
    shouldOpenTeamProfileOnboarding({
      teamWasCreated: false,
      teamAlreadyJoinedQuiz: false,
    }),
    true,
  );
});

test("returning teams keep the compact profile summary", () => {
  assert.equal(
    shouldOpenTeamProfileOnboarding({
      teamWasCreated: false,
      teamAlreadyJoinedQuiz: true,
    }),
    false,
  );
});
