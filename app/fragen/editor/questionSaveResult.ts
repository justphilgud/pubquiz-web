import type { FaceMorphPixelQuestionSyncResult } from "./types";

export function getAffectedQuestionIds(
  parentQuestionId: number,
  pixelQuestionSync?: FaceMorphPixelQuestionSyncResult,
): number[] {
  return [...new Set([
    parentQuestionId,
    ...(pixelQuestionSync?.children.map((child) => child.questionId) ?? []),
    ...(pixelQuestionSync?.detachedQuestionIds ?? []),
  ])];
}
