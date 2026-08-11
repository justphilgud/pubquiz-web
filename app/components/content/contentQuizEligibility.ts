import {
  isQuestionEligibleForQuiz,
  type QuestionScopeAccessContext,
} from "@/app/fragen/editor/questionScopePolicy";
import {
  canAttachStoryElementToQuiz,
  type StoryElementAccessContext,
} from "@/app/story-elemente/storyElementPolicy";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";

export type ContentQuizTarget = { quizId: number; eventSeriesId: number };

export function getAssignableQuestionQuizIds(
  question: QuestionScopeAccessContext & { validUntil: Date | null },
  quizzes: readonly ContentQuizTarget[],
  now: Date,
) {
  return quizzes.flatMap((quiz) => isQuestionEligibleForQuiz({
    scope: question.scope,
    eventSeriesIds: question.eventSeriesIds,
    quizEventSeriesId: quiz.eventSeriesId,
    isApproved: question.isApproved,
    isArchived: question.isArchived,
    validUntil: question.validUntil,
    now,
  }) ? [quiz.quizId] : []);
}

export function getAssignableStoryQuizIds(
  actor: AuthorizationActor,
  story: StoryElementAccessContext,
  quizzes: readonly ContentQuizTarget[],
) {
  return quizzes.flatMap((quiz) => canAttachStoryElementToQuiz(actor, story, quiz)
    ? [quiz.quizId]
    : []);
}

export function getUnassignedQuizIds(
  assignableQuizIds: readonly number[],
  assignedQuizIds: readonly number[],
) {
  const assigned = new Set(assignedQuizIds);
  return assignableQuizIds.filter((quizId) => !assigned.has(quizId));
}
