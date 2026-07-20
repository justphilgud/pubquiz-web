import type { Session } from "next-auth";
import type { QuestionReviewStatus } from "@/app/generated/prisma/enums";
import { redirect } from "next/navigation";
import { requireUser } from "./auth-guard";
import { getActorForSession } from "@/app/roles/roleAssignments.server";
import {
  canEditGlobalQuestions,
  getActorEventSeriesIds,
  canManageUsers as actorCanManageUsers,
  hasAnyEditorialAssignment,
  isAdministrator,
  type AuthorizationActor,
} from "@/app/roles/roleAssignmentPolicy";

export function isAdmin(actor: AuthorizationActor) {
  return isAdministrator(actor);
}

export function isEditor(actor: AuthorizationActor) {
  return canEditGlobalQuestions(actor) && !isAdministrator(actor);
}

export function canManageEverything(actor: AuthorizationActor) {
  return isAdministrator(actor);
}

export function canCreateQuestions(actor: AuthorizationActor) {
  return hasAnyEditorialAssignment(actor);
}

export function canEditQuestions(actor: AuthorizationActor) {
  return hasAnyEditorialAssignment(actor);
}

export function canEditQuestion(
  actor: AuthorizationActor,
  question: {
    createdByUserId: number | null;
    reviewStatus: QuestionReviewStatus;
    isArchived?: boolean;
  },
) {
  if (!canEditGlobalQuestions(actor)) return false;
  if (canManageEverything(actor)) return true;
  return question.createdByUserId === actor.userId && !question.isArchived &&
    (question.reviewStatus === "DRAFT" || question.reviewStatus === "CHANGES_REQUESTED");
}

export function canViewQuestion(
  actor: AuthorizationActor,
  question: {
    createdByUserId: number | null;
    reviewStatus: QuestionReviewStatus;
    isArchived?: boolean;
  },
) {
  if (canManageEverything(actor)) return true;
  return canEditGlobalQuestions(actor) && question.createdByUserId === actor.userId &&
    (question.reviewStatus === "DRAFT" || question.reviewStatus === "CHANGES_REQUESTED" ||
      question.reviewStatus === "IN_REVIEW");
}

export function canCloneQuestion(
  actor: AuthorizationActor,
  question: Parameters<typeof canViewQuestion>[1],
) {
  return canEditGlobalQuestions(actor) && canViewQuestion(actor, question);
}

export function canArchiveQuestion(
  actor: AuthorizationActor,
  question: { createdByUserId: number | null },
) {
  return canManageEverything(actor) ||
    (canEditGlobalQuestions(actor) && question.createdByUserId === actor.userId);
}

export function canDeleteQuestion(actor: AuthorizationActor) {
  return canManageEverything(actor);
}

export function canManageCategories(actor: AuthorizationActor) {
  return canManageEverything(actor);
}

export function canSearchQuestions(actor: AuthorizationActor) {
  return hasAnyEditorialAssignment(actor);
}

export function canApproveQuestions(actor: AuthorizationActor) {
  return canManageEverything(actor);
}

export function canSubmitForReview(actor: AuthorizationActor) {
  return hasAnyEditorialAssignment(actor) && !isAdministrator(actor);
}

export function canViewOwnQuestionWorklist(actor: AuthorizationActor) {
  return hasAnyEditorialAssignment(actor);
}

export function canViewReviewQueue(actor: AuthorizationActor) {
  return canReviewQuestions(actor);
}

export function canReviewQuestions(actor: AuthorizationActor) {
  return canManageEverything(actor) || getActorEventSeriesIds(actor, "EVENT_MANAGER").length > 0;
}

export function canApproveQuestion(actor: AuthorizationActor) {
  return canReviewQuestions(actor);
}

export function canRequestQuestionChanges(
  actor: AuthorizationActor,
  reviewStatus: QuestionReviewStatus,
) {
  return canReviewQuestions(actor) && reviewStatus === "IN_REVIEW";
}

export type QuestionOverviewCapabilities = {
  canViewOwnQuestionWorklist: boolean;
  canViewReviewQueue: boolean;
};

export function getQuestionOverviewCapabilities(
  actor: AuthorizationActor,
): QuestionOverviewCapabilities {
  return {
    canViewOwnQuestionWorklist: canViewOwnQuestionWorklist(actor),
    canViewReviewQueue: canViewReviewQueue(actor),
  };
}

export type QuestionEditorCapabilities = {
  canSaveDraft: boolean;
  canSubmitForReview: boolean;
  canApproveQuestion: boolean;
  canRequestQuestionChanges: boolean;
  canCloneQuestion: boolean;
  canArchiveQuestion: boolean;
  canDeleteQuestion: boolean;
  canManageCategories: boolean;
};

export function getQuestionEditorCapabilities(
  actor: AuthorizationActor,
  question?: {
    createdByUserId: number | null;
    reviewStatus: QuestionReviewStatus;
    isArchived?: boolean;
  },
): QuestionEditorCapabilities {
  if (question) {
    const canEdit = canEditQuestion(actor, question);
    return {
      canSaveDraft: canEdit,
      canSubmitForReview: canEdit && canSubmitForReview(actor),
      canApproveQuestion: canApproveQuestion(actor),
      canRequestQuestionChanges: canRequestQuestionChanges(actor, question.reviewStatus),
      canCloneQuestion: canCloneQuestion(actor, question),
      canArchiveQuestion: canArchiveQuestion(actor, question),
      canDeleteQuestion: canDeleteQuestion(actor),
      canManageCategories: canManageCategories(actor),
    };
  }
  return {
    canSaveDraft: canCreateQuestions(actor),
    canSubmitForReview: canSubmitForReview(actor),
    canApproveQuestion: canReviewQuestions(actor),
    canRequestQuestionChanges: false,
    canCloneQuestion: false,
    canArchiveQuestion: false,
    canDeleteQuestion: false,
    canManageCategories: canManageCategories(actor),
  };
}

export function canAssignQuestionsToQuiz(actor: AuthorizationActor) {
  return canManageEverything(actor);
}

export function canManageQuizzes(actor: AuthorizationActor) {
  return canManageEverything(actor) || getActorEventSeriesIds(actor, "EVENT_MANAGER").length > 0;
}

export function canManageUsers(actor: AuthorizationActor) {
  return actorCanManageUsers(actor);
}

export function canManageEventSeries(actor: AuthorizationActor) {
  return canManageQuizzes(actor);
}

export function canViewAdminTools(actor: AuthorizationActor) {
  return canManageEverything(actor);
}

export type DashboardCapabilities = {
  canCreateQuestion: boolean;
  canViewQuestionEditorial: boolean;
  canViewOwnQuestionWorklist: boolean;
  canViewReviewQueue: boolean;
  canManageQuizzes: boolean;
  canManageUsers: boolean;
  canViewAdminTools: boolean;
};

export function getDashboardCapabilities(actor: AuthorizationActor): DashboardCapabilities {
  return {
    canCreateQuestion: canCreateQuestions(actor),
    canViewQuestionEditorial: canSearchQuestions(actor),
    canViewOwnQuestionWorklist: canViewOwnQuestionWorklist(actor),
    canViewReviewQueue: canViewReviewQueue(actor),
    canManageQuizzes: canManageQuizzes(actor),
    canManageUsers: canManageUsers(actor),
    canViewAdminTools: canViewAdminTools(actor),
  };
}

export function canModerateQuiz(actor: AuthorizationActor) {
  return canManageQuizzes(actor);
}

export function canViewEvaluation(actor: AuthorizationActor) {
  return canManageQuizzes(actor);
}

export function canSearchUnapprovedQuestions(actor: AuthorizationActor) {
  return canReviewQuestions(actor);
}

export function canCreateApprovedQuestion(actor: AuthorizationActor) {
  return canManageEverything(actor);
}

export async function requireSession() {
  const session = await requireUser();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireActor() {
  const session = await requireSession();
  const actor = await getActorForSession(session);
  return { session, actor };
}

export async function requireAdmin() {
  const { session, actor } = await requireActor();
  if (!canManageEverything(actor)) redirect("/fragen");
  return Object.assign(session, { actor });
}

export async function requireQuestionEditor() {
  const { session, actor } = await requireActor();
  if (!canCreateQuestions(actor)) redirect("/login");
  return Object.assign(session, { actor });
}

export type { AuthorizationActor };
export type { Session };
