import assert from "node:assert/strict";
import test from "node:test";
import { mayLeaveMemeQuestion } from "./memeNavigationPolicy";
test("zero-entry closed skip permits forward navigation without a fictitious voting result", () => {
  assert.equal(mayLeaveMemeQuestion({ finalizedResult: false, reviewState: "SKIPPED", runState: "CLOSED", selectedCandidates: 0 }), true);
});
test("unfinished or selected meme rounds still require finalized voting", () => {
  for (const reviewState of [null, "IN_REVIEW", "COMPLETED", "SKIPPED"]) {
    assert.equal(mayLeaveMemeQuestion({ finalizedResult: false, reviewState, runState: "OPEN", selectedCandidates: 0 }), false);
  }
  assert.equal(mayLeaveMemeQuestion({ finalizedResult: false, reviewState: "SKIPPED", runState: "CLOSED", selectedCandidates: 1 }), false);
  assert.equal(mayLeaveMemeQuestion({ finalizedResult: true, reviewState: "COMPLETED", runState: "CLOSED", selectedCandidates: 3 }), true);
});
