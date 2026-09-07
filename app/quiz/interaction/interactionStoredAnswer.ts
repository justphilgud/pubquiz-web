import type { Prisma } from "@/app/generated/prisma/client";
import type { ResolvedQuizAnswerInteraction } from "../answerInteraction";
import type { TeamAnswerDraftInput } from "./interactionPayload";

export function readInteractionSnapshot(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Interaction-Snapshot ist ung\u00fcltig.");
  }
  const interaction = (value as { interaction?: unknown }).interaction;
  if (!interaction || typeof interaction !== "object" || !("type" in interaction)) {
    throw new Error("Interaction-Snapshot enth\u00e4lt keinen Contract.");
  }
  return interaction as ResolvedQuizAnswerInteraction;
}

export function draftInputFromStored(answer: {
  antwort_text: string | null;
  antwort_id: number | null;
  antwortauswahlen: readonly { antwort_id: number }[];
  antwortfelder: readonly { antwortfeld_id: number; antwort_text: string | null }[];
}): TeamAnswerDraftInput {
  return {
    answerText: answer.antwort_text,
    selectedAnswerIds:
      answer.antwortauswahlen.length > 0
        ? answer.antwortauswahlen.map((selection) => selection.antwort_id)
        : answer.antwort_id === null
          ? []
          : [answer.antwort_id],
    structuredAnswers: answer.antwortfelder.map((field) => ({
      fieldId: field.antwortfeld_id,
      answerText: field.antwort_text,
    })),
  };
}

