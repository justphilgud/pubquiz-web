import type { FaceMorphPixelQuestionOptions } from "./types";

export const FACE_MORPH_PIXEL_RELATION_TYPE = "facemorph_pixel";

export type FaceMorphPixelSource = {
  answerPosition: 1 | 2;
  imageUrl: string;
};

export type FaceMorphPixelRelationState = {
  answerPosition: 1 | 2;
  childQuestionId: number;
  active: boolean;
  inputImageUrl: string | null;
};

export type FaceMorphPixelPlanEntry =
  | { action: "NONE"; answerPosition: 1 | 2 }
  | { action: "DEACTIVATE"; answerPosition: 1 | 2; childQuestionId: number }
  | { action: "CREATE"; answerPosition: 1 | 2; imageUrl: string }
  | {
      action: "REUSE";
      answerPosition: 1 | 2;
      childQuestionId: number;
      imageUrl: string;
      imageChanged: boolean;
      reactivate: boolean;
    };

export function buildFaceMorphPixelQuestionPlan(
  options: FaceMorphPixelQuestionOptions,
  sources: readonly FaceMorphPixelSource[],
  relations: readonly FaceMorphPixelRelationState[],
): FaceMorphPixelPlanEntry[] {
  const sourcesByPosition = new Map(
    sources.map((source) => [source.answerPosition, source]),
  );
  const relationsByPosition = new Map(
    relations.map((relation) => [relation.answerPosition, relation]),
  );

  return ([1, 2] as const).map((answerPosition) => {
    const enabled = options[`answer${answerPosition}`];
    const relation = relationsByPosition.get(answerPosition);

    if (!enabled) {
      return relation?.active
        ? { action: "DEACTIVATE", answerPosition, childQuestionId: relation.childQuestionId }
        : { action: "NONE", answerPosition };
    }

    const source = sourcesByPosition.get(answerPosition);
    if (!source) {
      return { action: "NONE", answerPosition };
    }

    if (!relation) {
      return { action: "CREATE", answerPosition, imageUrl: source.imageUrl };
    }

    return {
      action: "REUSE",
      answerPosition,
      childQuestionId: relation.childQuestionId,
      imageUrl: source.imageUrl,
      imageChanged: relation.inputImageUrl !== source.imageUrl,
      reactivate: !relation.active,
    };
  });
}

export function hasActiveCoupledQuestionInQuiz(
  questionId: number,
  assignedQuestionIds: ReadonlySet<number>,
  relations: readonly {
    sourceQuestionId: number;
    childQuestionId: number;
    active: boolean;
  }[],
): boolean {
  return relations.some((relation) => {
    if (!relation.active) return false;
    if (relation.sourceQuestionId === questionId) {
      return assignedQuestionIds.has(relation.childQuestionId);
    }
    if (relation.childQuestionId === questionId) {
      return assignedQuestionIds.has(relation.sourceQuestionId);
    }
    return false;
  });
}

export async function runFaceMorphPixelQuestionGenerators(
  children: readonly { answerPosition: 1 | 2; questionId: number }[],
  runGenerator: (
    questionId: number,
  ) => Promise<{ ok: true } | { ok: false; code: string }>,
) {
  const results: Array<{
    answerPosition: 1 | 2;
    questionId: number;
    status: "SUCCEEDED" | "FAILED";
    errorCode?: string;
  }> = [];
  for (const child of children) {
    try {
      const result = await runGenerator(child.questionId);
      results.push({
        ...child,
        status: result.ok ? "SUCCEEDED" : "FAILED",
        ...(result.ok ? {} : { errorCode: result.code }),
      });
    } catch {
      results.push({
        ...child,
        status: "FAILED",
        errorCode: "GENERATOR_PROCESSING_FAILED",
      });
    }
  }
  return results;
}
