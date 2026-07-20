"use server";

import { prisma } from "@/app/lib/prisma";
import { isAdmin, requireQuestionEditor } from "@/app/lib/permissions";
import {
  calculateQuestionSimilarity,
  normalizeQuestionForSimilarity,
} from "./questionSimilarity";

export type SimilarQuestion = {
  questionId: number;
  questionText: string;
  similarity: number;
};

export async function findSimilarQuestions(
  questionText: string,
  excludeQuestionId?: number,
): Promise<SimilarQuestion[]> {
  const session = await requireQuestionEditor();
  const normalized = normalizeQuestionForSimilarity(questionText).slice(0, 300);
  if (normalized.length < 12) return [];
  const terms = [...new Set(normalized.split(" ").filter((term) => term.length >= 4))]
    .sort((left, right) => right.length - left.length)
    .slice(0, 4);
  if (terms.length === 0) return [];

  const candidates = await prisma.fragen.findMany({
    where: {
      fragen_id: excludeQuestionId ? { not: excludeQuestionId } : undefined,
      created_by_user_id: isAdmin(session.actor) ? undefined : Number(session.user.id),
      ist_archiviert: false,
      OR: terms.map((term) => ({
        frage: { contains: term, mode: "insensitive" as const },
      })),
    },
    orderBy: { updated_at: "desc" },
    take: 50,
    select: { fragen_id: true, frage: true },
  });

  return candidates
    .map((candidate) => ({
      questionId: candidate.fragen_id,
      questionText: candidate.frage,
      similarity: calculateQuestionSimilarity(questionText, candidate.frage),
    }))
    .filter((candidate) => candidate.similarity >= 0.58)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 5);
}
