import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryQuestionRewriteRateLimit } from "./questionRewriteRateLimit.server";

test("rate limit blocks accidental repeated clicks for the same user", () => {
  let now = 1_000;
  const limit = new InMemoryQuestionRewriteRateLimit(2_000, () => now);
  assert.equal(limit.acquire(7), true);
  assert.equal(limit.acquire(7), false);
  assert.equal(limit.acquire(8), true);
  now += 2_000;
  assert.equal(limit.acquire(7), true);
});
