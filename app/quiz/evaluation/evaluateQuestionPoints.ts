import type { BaseAnswerEvaluation, QuestionPointsEvaluation } from "./evaluationTypes";

export function evaluateQuestionPoints(
  base: BaseAnswerEvaluation,
  pointsMode: string,
): QuestionPointsEvaluation {
  return {
    ...base,
    finalPoints:
      pointsMode === "expertenbonus"
        ? base.basePoints.mul(2)
        : base.basePoints,
  };
}
