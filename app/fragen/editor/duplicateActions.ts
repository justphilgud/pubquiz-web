"use server";

import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { isAdmin, requireQuestionEditor } from "@/app/lib/permissions";
import {
  compareQuestionFingerprints,
  getQuestionDuplicateFingerprint,
  usesQuestionTextSimilarity,
  type QuestionDuplicateInput,
} from "./questionSimilarity";
import { questionVisibilityWhere } from "./questionVisibility";
import type { QuestionTemplateConfig } from "./types";
import { createAnswerMediaDraftFromStoredMedia, createQuestionMediaDraftFromStoredMedia } from "./questionMedia";
import { getQuestionTemplatePersistenceIds, questionTemplateIds, resolveCanonicalQuestionTemplateId } from "./templates/questionTemplateRegistry";
import { classicQuestionTemplateWhere, questionTextSimilarityWhere } from "./questionSimilarityQuery";

const duplicateMedia = {
  orderBy: [{ sortierung: "asc" as const }, { medien_id: "asc" as const }],
  select: { medien_id: true, datei: true, slot_key: true, medientyp: { select: { medientyp: true } } },
};

export type SimilarQuestion = {
  questionId: number;
  questionText: string;
  similarity: number;
};

export async function findSimilarQuestions(
  input: QuestionDuplicateInput,
  excludeQuestionId?: number,
): Promise<SimilarQuestion[]> {
  const session = await requireQuestionEditor();
  const compareText = usesQuestionTextSimilarity(input.templateId, input.hasCustomTemplate);
  const fingerprint = getQuestionDuplicateFingerprint(input);
  if (!fingerprint || (compareText && fingerprint.length < 12)) return [];

  const template = resolveCanonicalQuestionTemplateId(input.templateId);
  const where: Prisma.fragenWhereInput = {
    fragen_id: excludeQuestionId ? { not: excludeQuestionId } : undefined,
    created_by_user_id: isAdmin(session.actor) ? undefined : Number(session.user.id),
    ist_archiviert: false,
    AND: [
      questionVisibilityWhere(session.actor),
      compareText
        ? questionTextSimilarityWhere
        : template === null || template === questionTemplateIds.multipleChoice
          ? { ...classicQuestionTemplateWhere, source_vorlage_id: { not: null } }
          : { vorlage: { code: { in: [...getQuestionTemplatePersistenceIds(template)] } } },
    ],
  };
  if (compareText) {
    const candidates = await prisma.fragen.findMany({
      where, orderBy: [{ updated_at: "desc" }, { fragen_id: "desc" }], take: 200,
      select: { fragen_id: true, frage: true },
    });
    return candidates.map(candidate => ({
      questionId: candidate.fragen_id,
      questionText: candidate.frage,
      similarity: compareQuestionFingerprints(fingerprint, candidate.frage, true),
    })).filter(candidate => candidate.similarity >= 0.58)
      .sort((left, right) => right.similarity - left.similarity).slice(0, 5);
  }

  const matches: SimilarQuestion[] = [];
  // Limit memory per request without hiding an older exact template duplicate.
  let before: number | undefined;
  do {
    const pageWhere: Prisma.fragenWhereInput = before === undefined ? where : {
      AND: [where, { fragen_id: { lt: before } }],
    };
    const candidates = await prisma.fragen.findMany({
      where: pageWhere,
      orderBy: { fragen_id: "desc" },
      take: 200,
      select: {
        fragen_id: true,
        frage: true,
        template_config_json: true,
        source_vorlage_id: true,
        vorlage: { select: { code: true } },
        medien: duplicateMedia,
        antworten: { select: { antwort: true, ist_richtig: true, medien: duplicateMedia } },
        antwortfelder: { select: {
          label: true,
          medien: duplicateMedia,
          loesungen: { select: { loesung_text: true, ist_akzeptiert: true } },
        } },
      },
    });
    for (const candidate of candidates) {
      const templateId = candidate.vorlage?.code ?? null;
      const candidateFingerprint = getQuestionDuplicateFingerprint({
        questionText: candidate.frage,
        templateId,
        hasCustomTemplate: candidate.source_vorlage_id !== null,
        templateConfig: candidate.template_config_json as
          | QuestionTemplateConfig
          | null,
        media: createQuestionMediaDraftFromStoredMedia(candidate.medien, templateId),
        answers: [
          ...candidate.antworten.map(answer => ({
            text: answer.antwort,
            isCorrect: answer.ist_richtig,
            media: createAnswerMediaDraftFromStoredMedia(answer.medien),
          })),
          ...candidate.antwortfelder.flatMap(field =>
            field.loesungen.map(solution => ({
              text: solution.loesung_text,
              isCorrect: solution.ist_akzeptiert,
              fieldLabel: field.label,
              media: createAnswerMediaDraftFromStoredMedia(field.medien),
            })),
          ),
        ],
      });
      if (compareQuestionFingerprints(fingerprint, candidateFingerprint, false)) {
        matches.push({ questionId: candidate.fragen_id, questionText: candidate.frage, similarity: 1 });
        if (matches.length === 5) return matches;
      }
    }
    before = candidates.length === 200 ? candidates.at(-1)?.fragen_id : undefined;
  } while (before !== undefined);
  return matches;
}
