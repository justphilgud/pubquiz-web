import { Prisma } from "@/app/generated/prisma/client";
import {
  isPollQuestionTemplateId,
  questionTemplateIds,
  resolveCanonicalQuestionTemplateId,
} from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { hasText, normalizeEvaluationText } from "./evaluationDetails";
import type {
  BaseAnswerEvaluation,
  BaseAnswerInput,
  EvaluationStatus,
} from "./evaluationTypes";

const ZERO = new Prisma.Decimal(0);
const HALF = new Prisma.Decimal("0.5");
const QUARTER = new Prisma.Decimal("0.25");

function statusFor(points: Prisma.Decimal, maximum: Prisma.Decimal): EvaluationStatus {
  if (points.eq(0)) return "WRONG";
  if (points.eq(maximum)) return "CORRECT";
  return "PARTIAL";
}

function unanswered(maxPoints: Prisma.Decimal, strategy: BaseAnswerEvaluation["details"]["strategy"]): BaseAnswerEvaluation {
  return {
    basePoints: ZERO,
    maxPoints,
    status: "UNANSWERED",
    details: { strategy },
  };
}

function evaluateStructuredFields(input: BaseAnswerInput): BaseAnswerEvaluation {
  const maxPoints = HALF.mul(input.structuredFields.length);
  const submitted = input.structuredFields.some((field) =>
    hasText(input.structuredAnswers.get(field.id)),
  );
  if (!submitted) return unanswered(maxPoints, "STRUCTURED_FIELDS");

  const correctComponents = input.structuredFields.filter((field) => {
    const submittedValue = normalizeEvaluationText(
      input.structuredAnswers.get(field.id) ?? "",
    );
    return (
      submittedValue.length > 0 &&
      field.acceptedSolutions.some(
        (solution) => normalizeEvaluationText(solution) === submittedValue,
      )
    );
  }).length;
  const basePoints = HALF.mul(correctComponents);

  return {
    basePoints,
    maxPoints,
    status: statusFor(basePoints, maxPoints),
    details: {
      strategy: "STRUCTURED_FIELDS",
      correctComponents,
      totalComponents: input.structuredFields.length,
    },
  };
}

function evaluateOrdering(input: BaseAnswerInput): BaseAnswerEvaluation {
  const maxPoints = QUARTER.mul(input.orderingItems.length);
  if (!hasText(input.answerText)) return unanswered(maxPoints, "ORDERING");

  let selected: unknown;
  try {
    selected = JSON.parse(input.answerText ?? "");
  } catch {
    selected = null;
  }
  if (
    !Array.isArray(selected) ||
    !selected.every((entry) => typeof entry === "string") ||
    selected.length !== input.orderingItems.length ||
    new Set(selected).size !== selected.length ||
    selected.some((entry) => !input.orderingItems.includes(entry))
  ) {
    return {
      basePoints: ZERO,
      maxPoints,
      status: "REVIEW_REQUIRED",
      details: { strategy: "ORDERING", reason: "INVALID_ORDERING_PAYLOAD" },
    };
  }

  const correctComponents = selected.filter(
    (entry, index) => entry === input.orderingItems[index],
  ).length;
  const basePoints = QUARTER.mul(correctComponents);
  return {
    basePoints,
    maxPoints,
    status: statusFor(basePoints, maxPoints),
    details: {
      strategy: "ORDERING",
      correctComponents,
      totalComponents: input.orderingItems.length,
    },
  };
}

function evaluateMultipleChoice(input: BaseAnswerInput): BaseAnswerEvaluation {
  const correctIds = new Set(
    input.answerOptions.filter((answer) => answer.isCorrect).map((answer) => answer.id),
  );
  const maxPoints = HALF.mul(correctIds.size);
  if (input.selectedAnswerIds.length === 0) {
    return unanswered(maxPoints, "MULTIPLE_CHOICE");
  }
  const correctSelections = input.selectedAnswerIds.filter((id) => correctIds.has(id)).length;
  const incorrectSelections = input.selectedAnswerIds.length - correctSelections;
  let basePoints = Prisma.Decimal.max(
    ZERO,
    HALF.mul(correctSelections).sub(HALF.mul(incorrectSelections)),
  );
  if (
    input.answerOptions.length > 1 &&
    input.selectedAnswerIds.length === input.answerOptions.length &&
    basePoints.eq(maxPoints)
  ) {
    basePoints = Prisma.Decimal.max(ZERO, maxPoints.sub(HALF));
  }
  return {
    basePoints,
    maxPoints,
    status: statusFor(basePoints, maxPoints),
    details: {
      strategy: "MULTIPLE_CHOICE",
      correctSelections,
      incorrectSelections,
      totalComponents: correctIds.size,
    },
  };
}

// Runtime contract: docs/architecture/quiz-runtime-contracts.md
// Exact open-answer grading intentionally performs only trim and de-DE case folding.
export function normalizeExactOpenAnswer(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
}

export function isNormalizedExactOpenAnswer(
  submitted: string,
  accepted: string,
) {
  const normalizedSubmitted = normalizeExactOpenAnswer(submitted);
  const normalizedAccepted = normalizeExactOpenAnswer(accepted);
  return normalizedSubmitted.length > 0 &&
    normalizedAccepted.length > 0 &&
    normalizedSubmitted === normalizedAccepted;
}

export function evaluateBaseAnswer(input: BaseAnswerInput): BaseAnswerEvaluation {
  const templateId = resolveCanonicalQuestionTemplateId(input.templateId);

  if (isPollQuestionTemplateId(templateId)) {
    return {
      basePoints: ZERO,
      maxPoints: ZERO,
      status: "UNANSWERED",
      details: { strategy: "NONE", reason: "POLL_HAS_NO_EVALUATION" },
    };
  }

  if (templateId === questionTemplateIds.ordering) {
    return evaluateOrdering(input);
  }
  if (
    input.structuredFields.length > 0 &&
    templateId !== questionTemplateIds.pixelImage
  ) {
    return evaluateStructuredFields(input);
  }
  if (templateId === questionTemplateIds.multipleChoice) {
    return evaluateMultipleChoice(input);
  }

  const hasAnswer =
    input.selectedAnswerIds.length > 0 || hasText(input.answerText);
  if (!hasAnswer) return unanswered(new Prisma.Decimal(1), "SINGLE_CHOICE");

  if (
    input.effectiveAnswerMode !== "CLOSED" ||
    templateId === questionTemplateIds.pixelImage ||
    templateId === questionTemplateIds.estimate
  ) {
    const hasExactAcceptedAnswer =
      input.effectiveAnswerMode === "OPEN" &&
      templateId !== questionTemplateIds.pixelImage &&
      templateId !== questionTemplateIds.estimate &&
      hasText(input.answerText) &&
      input.answerOptions.some(
        (answer) =>
          answer.isCorrect &&
          hasText(answer.text) &&
          isNormalizedExactOpenAnswer(input.answerText!, answer.text!),
      );
    if (hasExactAcceptedAnswer) {
      return {
        basePoints: new Prisma.Decimal(1),
        maxPoints: new Prisma.Decimal(1),
        status: "CORRECT",
        details: { strategy: "EXACT_OPEN_ANSWER" },
      };
    }
    return {
      basePoints: ZERO,
      maxPoints: new Prisma.Decimal(1),
      status: "REVIEW_REQUIRED",
      details: { strategy: "MANUAL", reason: "MANUAL_EVALUATION" },
    };
  }

  const correctIds = new Set(
    input.answerOptions.filter((answer) => answer.isCorrect).map((answer) => answer.id),
  );
  const basePoints =
    input.selectedAnswerIds.length === 1 && correctIds.has(input.selectedAnswerIds[0])
      ? new Prisma.Decimal(1)
      : ZERO;
  return {
    basePoints,
    maxPoints: new Prisma.Decimal(1),
    status: statusFor(basePoints, new Prisma.Decimal(1)),
    details: { strategy: "SINGLE_CHOICE" },
  };
}
