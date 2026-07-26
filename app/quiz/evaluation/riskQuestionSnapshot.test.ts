import assert from "node:assert/strict";
import test from "node:test";
import {
  isRiskPoolEligible,
  shouldFreezeRiskPool,
} from "./riskQuestionSnapshot";

const fixedAt = new Date("2026-07-26T18:00:00.000Z");

test("risk pool freezes on the first evaluation, not on configuration alone", () => {
  assert.equal(
    shouldFreezeRiskPool({
      existingTeamCount: null,
      existingFixedAt: null,
      hasEvaluations: false,
      refreeze: false,
    }),
    false,
  );
  assert.equal(
    shouldFreezeRiskPool({
      existingTeamCount: null,
      existingFixedAt: null,
      hasEvaluations: true,
      refreeze: false,
    }),
    true,
  );
});

test("normal recalculation keeps a complete snapshot", () => {
  assert.equal(
    shouldFreezeRiskPool({
      existingTeamCount: 8,
      existingFixedAt: fixedAt,
      hasEvaluations: true,
      refreeze: false,
    }),
    false,
  );
});

test("explicit refreeze replaces a complete snapshot", () => {
  assert.equal(
    shouldFreezeRiskPool({
      existingTeamCount: 8,
      existingFixedAt: fixedAt,
      hasEvaluations: true,
      refreeze: true,
    }),
    true,
  );
});

test("teams joining after the snapshot are not pool-eligible", () => {
  assert.equal(
    isRiskPoolEligible(
      new Date("2026-07-26T17:59:59.000Z"),
      fixedAt,
    ),
    true,
  );
  assert.equal(
    isRiskPoolEligible(
      new Date("2026-07-26T18:00:01.000Z"),
      fixedAt,
    ),
    false,
  );
});
