import {
  calculateQuestionSimilarity,
  normalizeQuestionForSimilarity,
} from "@/app/fragen/editor/questionSimilarity";
import type {
  DuplicateCandidate,
  ExistingQuestionForDuplicateCheck,
} from "./types";

export function findDuplicateCandidates(
  question: string,
  existingQuestions: readonly ExistingQuestionForDuplicateCheck[],
): DuplicateCandidate[] {
  const normalized = normalizeQuestionForSimilarity(question);
  return existingQuestions
    .flatMap<DuplicateCandidate>((candidate) => {
      const candidateNormalized = normalizeQuestionForSimilarity(candidate.question);
      const similarity = calculateQuestionSimilarity(question, candidate.question);
      if (normalized === candidateNormalized) {
        return [{ ...candidate, similarity: 1, kind: "EXACT" }];
      }
      if (similarity >= 0.58) {
        return [{ ...candidate, similarity, kind: "SEMANTIC" }];
      }
      return [];
    })
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 5);
}
