import type { Session } from "next-auth";
import type { QuestionReviewStatus } from "@/app/generated/prisma/enums";
import { redirect } from "next/navigation";
import { requireUser } from "./auth-guard";

export function isAdmin(session: Session | null) {
  return session?.user?.role === "ADMIN";
}

export function isEditor(session: Session | null) {
  return session?.user?.role === "EDITOR";
}

export function canManageEverything(session: Session | null) {
  return isAdmin(session);
}

export function canCreateQuestions(session: Session | null) {
  return isAdmin(session) || isEditor(session);
}

export function canEditQuestions(session: Session | null) {
  return isAdmin(session) || isEditor(session);
}

export function canEditQuestion(
  session: Session | null,
  question: {
    createdByUserId: number | null;
    reviewStatus: QuestionReviewStatus;
    isArchived?: boolean;
  },
) {
  if (!canEditQuestions(session)) {
    return false;
  }

  if (canManageEverything(session)) {
    return true;
  }

  const currentUserId = Number(session?.user?.id);

  return (
    isEditor(session) &&
    Number.isInteger(currentUserId) &&
    question.createdByUserId === currentUserId &&
    !question.isArchived &&
    (question.reviewStatus === "DRAFT" ||
      question.reviewStatus === "CHANGES_REQUESTED")
  );
}

export function canViewQuestion(
  session: Session | null,
  question: {
    createdByUserId: number | null;
    reviewStatus: QuestionReviewStatus;
    isArchived?: boolean;
  },
) {
  if (canManageEverything(session)) {
    return true;
  }

  const currentUserId = Number(session?.user?.id);

  return (
    isEditor(session) &&
    Number.isInteger(currentUserId) &&
    question.createdByUserId === currentUserId &&
    (question.reviewStatus === "DRAFT" ||
      question.reviewStatus === "CHANGES_REQUESTED" ||
      question.reviewStatus === "IN_REVIEW")
  );
}

export function canCloneQuestion(
  session: Session | null,
  question: Parameters<typeof canViewQuestion>[1],
) {
  return canCreateQuestions(session) && canViewQuestion(session, question);
}

export function canArchiveQuestion(
  session: Session | null,
  question: { createdByUserId: number | null },
) {
  if (canManageEverything(session)) return true;
  const currentUserId = Number(session?.user?.id);
  return isEditor(session) && Number.isInteger(currentUserId) &&
    question.createdByUserId === currentUserId;
}

export function canDeleteQuestion(session: Session | null) {
  return canManageEverything(session);
}

export function canSearchQuestions(session: Session | null) {
  return isAdmin(session) || isEditor(session);
}

export function canApproveQuestions(session: Session | null) {
  return isAdmin(session);
}

export function canSubmitForReview(session: Session | null) {
  return isEditor(session);
}

export function canViewOwnQuestionWorklist(session: Session | null) {
  return isEditor(session);
}

export function canViewReviewQueue(session: Session | null) {
  return canReviewQuestions(session);
}

export function canReviewQuestions(session: Session | null) {
  return isAdmin(session);
}

export function canApproveQuestion(
  session: Session | null,
  reviewStatus: QuestionReviewStatus,
) {
  return canReviewQuestions(session) && reviewStatus !== "APPROVED";
}

export function canRequestQuestionChanges(
  session: Session | null,
  reviewStatus: QuestionReviewStatus,
) {
  return canReviewQuestions(session) && reviewStatus === "IN_REVIEW";
}

export type QuestionOverviewCapabilities = {
  canViewOwnQuestionWorklist: boolean;
  canViewReviewQueue: boolean;
};

export function getQuestionOverviewCapabilities(
  session: Session | null,
): QuestionOverviewCapabilities {
  return {
    canViewOwnQuestionWorklist: canViewOwnQuestionWorklist(session),
    canViewReviewQueue: canViewReviewQueue(session),
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
};

export function getQuestionEditorCapabilities(
  session: Session | null,
  question?: {
    createdByUserId: number | null;
    reviewStatus: QuestionReviewStatus;
    isArchived?: boolean;
  },
): QuestionEditorCapabilities {
  if (question) {
    const canEdit = canEditQuestion(session, question);

    return {
      canSaveDraft: canEdit,
      canSubmitForReview: canEdit && canSubmitForReview(session),
      canApproveQuestion: canApproveQuestion(
        session,
        question.reviewStatus,
      ),
      canRequestQuestionChanges: canRequestQuestionChanges(
        session,
        question.reviewStatus,
      ),
      canCloneQuestion: canCloneQuestion(session, question),
      canArchiveQuestion: canArchiveQuestion(session, question),
      canDeleteQuestion: canDeleteQuestion(session),
    };
  }

  return {
    canSaveDraft: canCreateQuestions(session),
    canSubmitForReview: canSubmitForReview(session),
    canApproveQuestion: canReviewQuestions(session),
    canRequestQuestionChanges: false,
    canCloneQuestion: false,
    canArchiveQuestion: false,
    canDeleteQuestion: false,
  };
}

export function canAssignQuestionsToQuiz(session: Session | null) {
  return isAdmin(session);
}

export function canManageQuizzes(session: Session | null) {
  return isAdmin(session);
}

export function canManageUsers(session: Session | null) {
  return isAdmin(session);
}

export function canViewAdminTools(session: Session | null) {
  return isAdmin(session);
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

export function getDashboardCapabilities(
  session: Session | null,
): DashboardCapabilities {
  return {
    canCreateQuestion: canCreateQuestions(session),
    canViewQuestionEditorial: canSearchQuestions(session),
    canViewOwnQuestionWorklist: canViewOwnQuestionWorklist(session),
    canViewReviewQueue: canViewReviewQueue(session),
    canManageQuizzes: canManageQuizzes(session),
    canManageUsers: canManageUsers(session),
    canViewAdminTools: canViewAdminTools(session),
  };
}

export function canModerateQuiz(session: Session | null) {
  return isAdmin(session);
}

export function canViewEvaluation(session: Session | null) {
  return isAdmin(session);
}

export function canSearchUnapprovedQuestions(session: Session | null) {
  return isAdmin(session);
}

export function canCreateApprovedQuestion(session: Session | null) {
  return isAdmin(session);
}

export async function requireSession() {
  const session = await requireUser();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireSession();

  if (!canManageEverything(session)) {
    redirect("/fragen");
  }

  return session;
}

export async function requireQuestionEditor() {
  const session = await requireSession();

  if (!canCreateQuestions(session)) {
    redirect("/login");
  }

  return session;
}
