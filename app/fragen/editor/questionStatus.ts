import { canApproveScopedQuestion, type QuestionActorContext, type QuestionScopeAccessContext } from "./questionScopePolicy";

export type QuestionStatusTarget = "DRAFT" | "APPROVED";

export function shouldChangeOnlyQuestionStatus(questionId: number | undefined, hasUnsavedChanges: boolean, reviewStatus: string | undefined) {
  return questionId !== undefined && !hasUnsavedChanges && reviewStatus !== "APPROVED";
}

/** Status metadata only. Neither incomplete/content fields nor quiz data belong here. */
export function questionStatusUpdate(actor: QuestionActorContext, question: QuestionScopeAccessContext, target: QuestionStatusTarget, now = new Date()) {
  if (!Number.isSafeInteger(actor.userId) || actor.userId <= 0 || question.isArchived ||
      !canApproveScopedQuestion(actor, question)) throw new Error("QUESTION_STATUS_PERMISSION_DENIED");
  if (target !== "DRAFT" && target !== "APPROVED") throw new Error("QUESTION_STATUS_INVALID");
  if (target === "DRAFT" && (question.reviewStatus !== "APPROVED" || !question.isApproved)) {
    throw new Error("QUESTION_STATUS_CONFLICT");
  }
  if (target === "APPROVED" && question.isApproved) throw new Error("QUESTION_STATUS_CONFLICT");
  return {
    review_status: target,
    freigegeben: target === "APPROVED",
    approved_by_user_id: target === "APPROVED" ? actor.userId : null,
    approved_at: target === "APPROVED" ? now : null,
    reviewed_by_user_id: target === "APPROVED" ? actor.userId : null,
    reviewed_at: target === "APPROVED" ? now : null,
    review_feedback: null,
    last_modified_by_user_id: actor.userId,
  };
}
