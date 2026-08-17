import {
  isPollQuestionTemplateId,
  questionTemplateIds,
  resolveCanonicalQuestionTemplateId,
} from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { Decimal } from "@prisma/client-runtime-utils";

export type QuizQuestionPointsDisplay = {
  pointsLabel: string | null;
  modeLabel: string | null;
  isDynamic: boolean;
};

export function formatGermanPoints(value: Decimal.Value) {
  const points = new Decimal(value).toDecimalPlaces(2);
  const formatted = points
    .toFixed(2)
    .replace(/(?:\.0+|(\.\d+?)0+)$/, "$1")
    .replace(".", ",");
  return `${formatted} ${points.eq(1) ? "Punkt" : "Punkte"}`;
}

export function getQuizQuestionPointsDisplay(input: {
  templateId: string | null;
  pointsMode: string | null;
  basePoints: Decimal.Value;
}): QuizQuestionPointsDisplay {
  const templateId = resolveCanonicalQuestionTemplateId(input.templateId);

  if (isPollQuestionTemplateId(templateId)) {
    return { pointsLabel: null, modeLabel: "Umfrage", isDynamic: false };
  }

  if (templateId === questionTemplateIds.pixelImage) {
    return {
      pointsLabel: "1–3 Punkte",
      modeLabel: null,
      isDynamic: false,
    };
  }

  if (input.pointsMode === "risikofrage") {
    return {
      pointsLabel: "Dynamische Punkte",
      modeLabel: "Risikofrage",
      isDynamic: true,
    };
  }

  const displayedMaxPoints =
    input.pointsMode === "expertenbonus"
      ? new Decimal(input.basePoints).mul(2)
      : new Decimal(input.basePoints);

  return {
    pointsLabel: `max. ${formatGermanPoints(displayedMaxPoints)}`,
    modeLabel: input.pointsMode === "expertenbonus" ? "Expertenfrage" : null,
    isDynamic: false,
  };
}
