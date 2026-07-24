"use server";

import { prisma } from "@/app/lib/prisma";
import { isAdmin, requireQuestionEditor } from "@/app/lib/permissions";
import {
  calculateQuestionSimilarity,
  getQuestionDuplicateFingerprint,
  type QuestionDuplicateInput,
} from "./questionSimilarity";
import type { QuestionTemplateConfig } from "./types";

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
  const fingerprint = getQuestionDuplicateFingerprint(input).slice(0, 4_000);
  if (fingerprint.length < 12) return [];

  const candidates = await prisma.fragen.findMany({
    where: {
      fragen_id: excludeQuestionId ? { not: excludeQuestionId } : undefined,
      created_by_user_id: isAdmin(session.actor) ? undefined : Number(session.user.id),
      ist_archiviert: false,
    },
    orderBy: { updated_at: "desc" },
    take: 200,
    select: {
      fragen_id: true,
      frage: true,
      template_config_json: true,
      vorlage: { select: { code: true } },
      antworten: {
        orderBy: { antwort_id: "asc" },
        select: {
          antwort: true,
          ist_richtig: true,
          zusatzinformation: true,
        },
      },
    },
  });

  return candidates
    .map((candidate) => {
      const candidateFingerprint = getQuestionDuplicateFingerprint({
        questionText: candidate.frage,
        templateId: candidate.vorlage?.code ?? null,
        templateConfig: candidate.template_config_json as
          | QuestionTemplateConfig
          | null,
        answers: candidate.antworten.map((answer) => ({
          text: answer.antwort,
          isCorrect: answer.ist_richtig,
          additionalInfo: answer.zusatzinformation ?? "",
        })),
      });
      return {
        questionId: candidate.fragen_id,
        questionText: candidate.frage,
        similarity: calculateQuestionSimilarity(
          fingerprint,
          candidateFingerprint,
        ),
      };
    })
    .filter((candidate) => candidate.similarity >= 0.58)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 5);
}
