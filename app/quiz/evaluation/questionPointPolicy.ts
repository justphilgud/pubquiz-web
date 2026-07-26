import { Prisma } from "@/app/generated/prisma/client";
import {
  questionTemplateIds,
  resolveCanonicalQuestionTemplateId,
} from "@/app/fragen/editor/templates/questionTemplateRegistry";

export function getQuestionBaseMaximum(input: {
  templateId: string | null;
  correctAnswerCount: number;
  structuredFieldCount: number;
  orderingItemCount: number;
}) {
  const templateId = resolveCanonicalQuestionTemplateId(input.templateId);
  if (templateId === questionTemplateIds.ordering) {
    return new Prisma.Decimal(input.orderingItemCount).mul("0.25");
  }
  if (input.structuredFieldCount > 0) {
    return new Prisma.Decimal(input.structuredFieldCount).mul("0.5");
  }
  if (templateId === questionTemplateIds.multipleChoice) {
    return new Prisma.Decimal(input.correctAnswerCount).mul("0.5");
  }
  return new Prisma.Decimal(1);
}

export function isPartialPointsCapable(input: {
  templateId: string | null;
  correctAnswerCount: number;
  structuredFieldCount: number;
  orderingItemCount: number;
}) {
  const templateId = resolveCanonicalQuestionTemplateId(input.templateId);
  const maximum = getQuestionBaseMaximum(input);
  return (
    !maximum.eq(1) ||
    input.structuredFieldCount > 1 ||
    (templateId === questionTemplateIds.multipleChoice &&
      input.correctAnswerCount > 1) ||
    (templateId === questionTemplateIds.ordering &&
      input.orderingItemCount > 1)
  );
}

export function validateQuestionPointsMode(input: {
  templateId: string | null;
  pointsMode: string;
  correctAnswerCount: number;
  structuredFieldCount: number;
  orderingItemCount: number;
}) {
  const templateId = resolveCanonicalQuestionTemplateId(input.templateId);
  if (
    templateId === questionTemplateIds.pixelImage &&
    (input.pointsMode === "expertenbonus" || input.pointsMode === "risikofrage")
  ) {
    throw new Error("Pixelbild-Fragen dürfen weder Expertenbonus noch Risikomodus verwenden.");
  }
  if (input.pointsMode === "risikofrage" && isPartialPointsCapable(input)) {
    throw new Error(
      "Risikofragen sind nur bei Fragen ohne Teilpunkte möglich.",
    );
  }
}
