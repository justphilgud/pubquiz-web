import assert from "node:assert/strict";
import test from "node:test";
import { buildQuizOwnershipContext } from "./quizOwnershipPolicy";

test("quiz ownership context carries the event series without inventing an owner", () => {
  assert.deepEqual(buildQuizOwnershipContext(42), {
    ownerUserId: null,
    eventSeriesId: 42,
  });
});
