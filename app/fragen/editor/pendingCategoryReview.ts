import type { PendingCategoryDecision } from "./types";

export class PendingCategoryReviewError extends Error {
  constructor(
    readonly code:
      | "DECISIONS_REQUIRED"
      | "INVALID_DECISIONS"
      | "ADMIN_REQUIRED",
  ) {
    super(code);
    this.name = "PendingCategoryReviewError";
  }
}

export function resolvePendingCategoryReview(input: {
  intent: "DRAFT" | "SUBMIT_FOR_REVIEW" | "APPROVE" | "REQUEST_CHANGES";
  isAdministrator: boolean;
  selectedCategoryIds: readonly number[];
  pendingCategoryIds: readonly number[];
  decisions: readonly PendingCategoryDecision[] | undefined;
}) {
  if (input.intent !== "APPROVE" || input.pendingCategoryIds.length === 0) {
    if (input.decisions && input.decisions.length > 0) {
      throw new PendingCategoryReviewError("INVALID_DECISIONS");
    }
    return {
      approvedCategoryIds: [] as number[],
      discardedCategoryIds: [] as number[],
      retainedCategoryIds: [...input.selectedCategoryIds],
    };
  }

  if (!input.isAdministrator) {
    throw new PendingCategoryReviewError("ADMIN_REQUIRED");
  }
  if (!Array.isArray(input.decisions)) {
    throw new PendingCategoryReviewError("DECISIONS_REQUIRED");
  }

  const pendingIds = new Set(input.pendingCategoryIds);
  const decisionIds = new Set<number>();
  const approvedCategoryIds: number[] = [];
  const discardedCategoryIds: number[] = [];

  for (const decision of input.decisions) {
    if (
      !decision ||
      !Number.isInteger(decision.categoryId) ||
      !pendingIds.has(decision.categoryId) ||
      decisionIds.has(decision.categoryId) ||
      (decision.action !== "APPROVE" && decision.action !== "DISCARD")
    ) {
      throw new PendingCategoryReviewError("INVALID_DECISIONS");
    }
    decisionIds.add(decision.categoryId);
    if (decision.action === "APPROVE") {
      approvedCategoryIds.push(decision.categoryId);
    } else {
      discardedCategoryIds.push(decision.categoryId);
    }
  }

  if (
    decisionIds.size !== pendingIds.size ||
    [...pendingIds].some((categoryId) => !decisionIds.has(categoryId))
  ) {
    throw new PendingCategoryReviewError("DECISIONS_REQUIRED");
  }

  const discardedIds = new Set(discardedCategoryIds);
  return {
    approvedCategoryIds,
    discardedCategoryIds,
    retainedCategoryIds: input.selectedCategoryIds.filter(
      (categoryId) => !discardedIds.has(categoryId),
    ),
  };
}
