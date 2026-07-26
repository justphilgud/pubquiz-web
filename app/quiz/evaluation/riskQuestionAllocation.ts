import { Prisma } from "@/app/generated/prisma/client";
import type {
  EvaluationSource,
  EvaluationStatus,
} from "./evaluationTypes";

const ZERO = new Prisma.Decimal(0);
export const RISK_POINTS_DECIMAL_PLACES = 4;

export type RiskQuestionEvaluation = {
  teamAnswerId: number;
  status: EvaluationStatus;
  source: EvaluationSource;
  manualPoints: Prisma.Decimal | null;
  isPoolEligible: boolean;
};

export type RiskQuestionAllocation = {
  teamAnswerId: number;
  autoFinalPoints: Prisma.Decimal;
  finalPoints: Prisma.Decimal;
  source: EvaluationSource;
  status: EvaluationStatus;
};

export function allocateRiskQuestionPoints(input: {
  teamPoolSize: number;
  evaluations: readonly RiskQuestionEvaluation[];
}): {
  correctCount: number;
  pointsPerCorrectTeam: Prisma.Decimal;
  allocations: RiskQuestionAllocation[];
} {
  if (!Number.isInteger(input.teamPoolSize) || input.teamPoolSize < 0) {
    throw new Error("Der Risikopool muss eine nichtnegative ganze Teamanzahl sein.");
  }
  const correctCount = input.evaluations.filter(
    (evaluation) =>
      evaluation.isPoolEligible && evaluation.status === "CORRECT",
  ).length;
  const pointsPerCorrectTeam =
    correctCount === 0
      ? ZERO
      : new Prisma.Decimal(input.teamPoolSize)
          .div(correctCount)
          .toDecimalPlaces(RISK_POINTS_DECIMAL_PLACES);

  return {
    correctCount,
    pointsPerCorrectTeam,
    allocations: input.evaluations.map((evaluation) => {
      const autoFinalPoints =
        evaluation.isPoolEligible && evaluation.status === "CORRECT"
          ? pointsPerCorrectTeam
          : ZERO;
      return {
        teamAnswerId: evaluation.teamAnswerId,
        autoFinalPoints,
        finalPoints: evaluation.manualPoints ?? autoFinalPoints,
        source: evaluation.source,
        status: evaluation.status,
      };
    }),
  };
}
