import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@/app/generated/prisma/client";
import { allocateRiskQuestionPoints } from "./riskQuestionAllocation";
import type { EvaluationStatus } from "./evaluationTypes";

function evaluations(
  statuses: readonly EvaluationStatus[],
  options?: {
    ineligibleIds?: readonly number[];
    manualPointsById?: ReadonlyMap<number, string>;
  },
) {
  return statuses.map((status, index) => {
    const teamAnswerId = index + 1;
    const manualPoints = options?.manualPointsById?.get(teamAnswerId);
    return {
      teamAnswerId,
      status,
      source: manualPoints === undefined ? "AUTO" as const : "MANUAL" as const,
      manualPoints:
        manualPoints === undefined ? null : new Prisma.Decimal(manualPoints),
      isPoolEligible: !options?.ineligibleIds?.includes(teamAnswerId),
    };
  });
}

for (const [correctCount, expected] of [
  [8, "1"],
  [4, "2"],
  [2, "4"],
  [1, "8"],
  [0, "0"],
] as const) {
  test(`8 team pool with ${correctCount} correct allocates ${expected}`, () => {
    const result = allocateRiskQuestionPoints({
      teamPoolSize: 8,
      evaluations: evaluations([
        ...Array.from({ length: correctCount }, () => "CORRECT" as const),
        ...Array.from({ length: 8 - correctCount }, () => "WRONG" as const),
      ]),
    });
    assert.equal(result.pointsPerCorrectTeam.toString(), expected);
    assert.deepEqual(
      result.allocations.map((entry) => entry.autoFinalPoints.toString()),
      [
        ...Array.from({ length: correctCount }, () => expected),
        ...Array.from({ length: 8 - correctCount }, () => "0"),
      ],
    );
  });
}

test("periodic shares are persisted at four Decimal places", () => {
  const result = allocateRiskQuestionPoints({
    teamPoolSize: 8,
    evaluations: evaluations(["CORRECT", "CORRECT", "CORRECT"]),
  });
  assert.equal(result.pointsPerCorrectTeam.toString(), "2.6667");
});

test("only eligible CORRECT statuses participate in the pool", () => {
  const result = allocateRiskQuestionPoints({
    teamPoolSize: 8,
    evaluations: evaluations(
      ["CORRECT", "PARTIAL", "WRONG", "UNANSWERED", "REVIEW_REQUIRED", "CORRECT"],
      { ineligibleIds: [6] },
    ),
  });
  assert.equal(result.correctCount, 1);
  assert.deepEqual(
    result.allocations.map((entry) => entry.autoFinalPoints.toString()),
    ["8", "0", "0", "0", "0", "0"],
  );
});

test("manual points override one allocation without changing the denominator", () => {
  const result = allocateRiskQuestionPoints({
    teamPoolSize: 8,
    evaluations: evaluations(["CORRECT", "CORRECT"], {
      manualPointsById: new Map([[1, "3.5"]]),
    }),
  });
  assert.equal(result.correctCount, 2);
  assert.equal(result.allocations[0].autoFinalPoints.toString(), "4");
  assert.equal(result.allocations[0].finalPoints.toString(), "3.5");
  assert.equal(result.allocations[1].finalPoints.toString(), "4");
});
