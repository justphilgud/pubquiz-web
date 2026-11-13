import type { Prisma } from "@/app/generated/prisma/client";
import type { NormalizedAnswer, NormalizedDraft } from "./questionValidation";
import type { SaveQuestionPayload } from "./types";

export function newQuestionContent(
  draft: NormalizedDraft, target: Pick<SaveQuestionPayload, "scope" | "eventSeriesIds">,
  userId: number, templateId: number | null,
) {
  return {
    frage: draft.questionText,
    geltungsbereich: target.scope,
    quelle: draft.sourceOrRemark || null,
    vorlage_id: templateId,
    source_vorlage_id: draft.sourceTemplateId,
    template_config_json: draft.templateConfig,
    ist_archiviert: false,
    moderationsnotizen: draft.moderationNotes || null,
    kategorienwunsch: draft.categoryRequest || null,
    gueltig_bis: draft.validUntil,
    pruefen_ab: draft.reviewFrom,
    created_by_user_id: userId,
    last_modified_by_user_id: userId,
    eventreihen: target.scope === "EVENT_SERIES"
      ? { create: target.eventSeriesIds.map(eventreihe_id => ({ eventreihe_id })) }
      : undefined,
  } satisfies Prisma.fragenUncheckedCreateInput;
}

export function classicAnswerContent(questionId: number, answer: NormalizedAnswer, answerTypeId: number) {
  return {
    fragen_id: questionId,
    antwort: answer.text,
    ist_richtig: answer.isCorrect,
    zusatzinformation: answer.additionalInfo || null,
    antworttyp_id: answerTypeId,
  };
}

export function findStandardAnswerType(tx: Prisma.TransactionClient) {
  return tx.antworttyp.findFirst({
    where: { antworttyp: { equals: "Standard", mode: "insensitive" } },
    select: { antworttyp_id: true },
  });
}

export function questionCategoryConnections(ids: readonly number[]) {
  return ids.map(fragenkategorie_id => ({ fragenkategorie: { connect: { fragenkategorie_id } } }));
}
