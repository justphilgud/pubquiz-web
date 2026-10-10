import assert from "node:assert/strict";
import test from "node:test";
import { mayApplyLiveSnapshot } from "./liveSnapshotRevision";

test("late poll cannot undo navigation, a saved answer or revealed tiebreak; subsequent current poll is accepted", () => {
  assert.equal(mayApplyLiveSnapshot(4, 5, true, false), false);
  assert.equal(mayApplyLiveSnapshot(5, 5, true, true), false);
  assert.equal(mayApplyLiveSnapshot(5, 5, false, false), false);
  assert.equal(mayApplyLiveSnapshot(5, 5, true, false), true);
});
