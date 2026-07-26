import { Prisma } from "@/app/generated/prisma/client";

export const evaluationStatuses = [
  "UNANSWERED",
  "WRONG",
  "PARTIAL",
  "CORRECT",
  "REVIEW_REQUIRED",
] as const;

export type EvaluationStatus = (typeof evaluationStatuses)[number];
export type EvaluationSource = "AUTO" | "MANUAL" | "LEGACY";

export type EvaluationDetails = {
  strategy:
    | "SINGLE_CHOICE"
    | "MULTIPLE_CHOICE"
    | "STRUCTURED_FIELDS"
    | "ORDERING"
    | "MANUAL";
  correctComponents?: number;
  totalComponents?: number;
  correctSelections?: number;
  incorrectSelections?: number;
  reason?: string;
};

export type BaseAnswerEvaluation = {
  basePoints: Prisma.Decimal;
  maxPoints: Prisma.Decimal;
  status: EvaluationStatus;
  details: EvaluationDetails;
};

export type AnswerOption = {
  id: number;
  isCorrect: boolean;
};

export type StructuredAnswerField = {
  id: number;
  acceptedSolutions: readonly string[];
};

export type BaseAnswerInput = {
  templateId: string | null;
  effectiveAnswerMode: "OPEN" | "CLOSED" | "UNCLASSIFIED";
  answerOptions: readonly AnswerOption[];
  selectedAnswerIds: readonly number[];
  answerText: string | null;
  structuredFields: readonly StructuredAnswerField[];
  structuredAnswers: ReadonlyMap<number, string | null>;
  orderingItems: readonly string[];
};

export type QuestionPointsEvaluation = BaseAnswerEvaluation & {
  finalPoints: Prisma.Decimal;
};
