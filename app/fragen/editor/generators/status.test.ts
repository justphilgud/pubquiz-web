import assert from "node:assert/strict";
import test from "node:test";
import { assertGeneratorRunTransition, canTransitionGeneratorRun } from "./status";

test("generator run status allows only the defined lifecycle", () => {
  assert.equal(canTransitionGeneratorRun("PENDING", "PROCESSING"), true);
  assert.equal(canTransitionGeneratorRun("PROCESSING", "SUCCEEDED"), true);
  assert.equal(canTransitionGeneratorRun("SUCCEEDED", "STALE"), true);
  assert.throws(() => assertGeneratorRunTransition("SUCCEEDED", "PROCESSING"));
});
