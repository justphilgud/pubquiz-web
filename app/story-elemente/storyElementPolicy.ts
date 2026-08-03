import {
  canEditEventSeriesQuestions,
  canManageEventSeries,
  canManageEventSeriesQuizzes,
  canViewEventSeries,
  hasAnyEditorialAssignment,
  isAdministrator,
  type AuthorizationActor,
} from "@/app/roles/roleAssignmentPolicy";
import type {
  StoryElementScopeValue,
  StoryElementStatusValue,
} from "./storyElement";

export type StoryElementAccessContext = {
  scope: StoryElementScopeValue;
  eventSeriesId: number | null;
  quizId: number | null;
  quizEventSeriesId: number | null;
  createdByUserId: number | null;
  status: StoryElementStatusValue;
};

export function canAccessStoryElementLibrary(actor: AuthorizationActor) {
  return hasAnyEditorialAssignment(actor);
}

export function canCreateStoryElement(actor: AuthorizationActor) {
  return hasAnyEditorialAssignment(actor);
}

export function canUseStoryElementScope(
  actor: AuthorizationActor,
  input: {
    scope: StoryElementScopeValue;
    eventSeriesId: number | null;
    quizEventSeriesId: number | null;
  },
) {
  if (input.scope === "GLOBAL") return isAdministrator(actor);
  if (input.scope === "EVENT_SERIES") {
    return input.eventSeriesId !== null &&
      canEditEventSeriesQuestions(actor, input.eventSeriesId);
  }
  return input.quizEventSeriesId !== null &&
    canManageEventSeriesQuizzes(actor, input.quizEventSeriesId);
}

export function canViewStoryElement(
  actor: AuthorizationActor,
  story: StoryElementAccessContext,
) {
  if (isAdministrator(actor)) return true;
  if (story.scope === "GLOBAL") return hasAnyEditorialAssignment(actor);
  if (story.scope === "EVENT_SERIES") {
    return story.eventSeriesId !== null && canViewEventSeries(actor, story.eventSeriesId);
  }
  return story.quizEventSeriesId !== null &&
    canViewEventSeries(actor, story.quizEventSeriesId);
}

export function canEditStoryElement(
  actor: AuthorizationActor,
  story: StoryElementAccessContext,
) {
  if (story.status === "ARCHIVED") return false;
  if (isAdministrator(actor)) return true;
  if (story.scope === "GLOBAL") return false;
  if (story.scope === "EVENT_SERIES" && story.eventSeriesId !== null) {
    return canManageEventSeries(actor, story.eventSeriesId) ||
      (story.createdByUserId === actor.userId &&
        canEditEventSeriesQuestions(actor, story.eventSeriesId));
  }
  return story.quizEventSeriesId !== null &&
    canManageEventSeriesQuizzes(actor, story.quizEventSeriesId);
}

export function canArchiveStoryElement(
  actor: AuthorizationActor,
  story: StoryElementAccessContext,
) {
  if (isAdministrator(actor)) return true;
  if (story.scope === "EVENT_SERIES" && story.eventSeriesId !== null) {
    return canManageEventSeries(actor, story.eventSeriesId) ||
      story.createdByUserId === actor.userId;
  }
  return story.scope === "QUIZ" && story.quizEventSeriesId !== null &&
    canManageEventSeriesQuizzes(actor, story.quizEventSeriesId);
}

export function canAttachStoryElementToQuiz(
  actor: AuthorizationActor,
  story: StoryElementAccessContext,
  quiz: { quizId: number; eventSeriesId: number },
) {
  if (!canManageEventSeriesQuizzes(actor, quiz.eventSeriesId)) return false;
  const selectable = story.status === "ACTIVE" ||
    (story.status === "DRAFT" && story.createdByUserId === actor.userId);
  if (!selectable) return false;
  if (story.scope === "GLOBAL") return true;
  if (story.scope === "EVENT_SERIES") return story.eventSeriesId === quiz.eventSeriesId;
  return story.quizId === quiz.quizId;
}
