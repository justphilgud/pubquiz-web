import type { Session } from "next-auth";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { prisma } from "@/app/lib/prisma";
import {
  canApproveQuestions,
  canCreateApprovedQuestion,
  canCreateQuestions,
  canEditQuestions,
} from "@/app/lib/permissions";

type QuestionCreateData = Parameters<typeof prisma.fragen.create>[0]["data"];
type QuestionUpdateData = Parameters<typeof prisma.fragen.update>[0]["data"];

export function getCurrentUserId(session: Session) {
  const userId = Number(session.user.id);

  if (!Number.isInteger(userId)) {
    throw new Error("Ungültige User-Session.");
  }

  return userId;
}

export function resolveQuestionApprovalOnCreate(
  actor: AuthorizationActor,
  requestedApproval: boolean,
) {
  if (!canCreateQuestions(actor)) {
    throw new Error("Keine Berechtigung zum Erstellen von Fragen.");
  }

  if (!canCreateApprovedQuestion(actor)) {
    return {
      freigegeben: false,
      approved_by_user_id: null,
      approved_at: null,
    };
  }

  const userId = actor.userId;

  return {
    freigegeben: requestedApproval,
    approved_by_user_id: requestedApproval ? userId : null,
    approved_at: requestedApproval ? new Date() : null,
  };
}

export function resolveQuestionApprovalOnUpdate(
  actor: AuthorizationActor,
  currentFreigegeben: boolean,
  requestedApproval: boolean,
) {
  if (!canEditQuestions(actor)) {
    throw new Error("Keine Berechtigung zum Bearbeiten von Fragen.");
  }

  if (!canApproveQuestions(actor)) {
    return {
      freigegeben: currentFreigegeben,
      approved_by_user_id: undefined,
      approved_at: undefined,
    };
  }

  const userId = actor.userId;

  if (requestedApproval) {
    return {
      freigegeben: true,
      approved_by_user_id: userId,
      approved_at: new Date(),
    };
  }

  return {
    freigegeben: false,
    approved_by_user_id: null,
    approved_at: null,
  };
}

export async function approveQuestion(questionId: number, actor: AuthorizationActor) {
  if (!canApproveQuestions(actor)) {
    throw new Error("Keine Berechtigung zum Freigeben von Fragen.");
  }

  const userId = actor.userId;

  return prisma.fragen.update({
    where: { fragen_id: questionId },
    data: {
      freigegeben: true,
      approved_by_user_id: userId,
      approved_at: new Date(),
      last_modified_by_user_id: userId,
    },
  });
}

export async function unapproveQuestion(questionId: number, actor: AuthorizationActor) {
  if (!canApproveQuestions(actor)) {
    throw new Error("Keine Berechtigung zum Zurücknehmen der Freigabe.");
  }

  const userId = actor.userId;

  return prisma.fragen.update({
    where: { fragen_id: questionId },
    data: {
      freigegeben: false,
      approved_by_user_id: null,
      approved_at: null,
      last_modified_by_user_id: userId,
    },
  });
}

export async function createQuestion(
  data: QuestionCreateData,
  actor: AuthorizationActor,
  requestedApproval = false,
) {
  if (!canCreateQuestions(actor)) {
    throw new Error("Keine Berechtigung zum Erstellen von Fragen.");
  }

  const userId = actor.userId;
  const approval = resolveQuestionApprovalOnCreate(actor, requestedApproval);

  return prisma.fragen.create({
    data: {
      ...data,
      freigegeben: approval.freigegeben,
      approved_by_user_id: approval.approved_by_user_id,
      approved_at: approval.approved_at,
      created_by_user_id: userId,
      last_modified_by_user_id: userId,
    },
  });
}

export async function updateQuestion(
  questionId: number,
  data: QuestionUpdateData,
  actor: AuthorizationActor,
  requestedApproval?: boolean,
) {
  if (!canEditQuestions(actor)) {
    throw new Error("Keine Berechtigung zum Bearbeiten von Fragen.");
  }

  const userId = actor.userId;

  const currentQuestion = await prisma.fragen.findUnique({
    where: { fragen_id: questionId },
    select: { freigegeben: true },
  });

  if (!currentQuestion) {
    throw new Error("Frage nicht gefunden.");
  }

  const approval =
    requestedApproval === undefined
      ? {
          freigegeben: currentQuestion.freigegeben,
          approved_by_user_id: undefined,
          approved_at: undefined,
        }
      : resolveQuestionApprovalOnUpdate(
          actor,
          currentQuestion.freigegeben,
          requestedApproval,
        );

  return prisma.fragen.update({
    where: { fragen_id: questionId },
    data: {
      ...data,
      freigegeben: approval.freigegeben,
      approved_by_user_id: approval.approved_by_user_id,
      approved_at: approval.approved_at,
      last_modified_by_user_id: userId,
    },
  });
}
