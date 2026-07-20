import "server-only";

import type { Session } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { requireSession } from "@/app/lib/permissions";
import { getCurrentEventSeriesAssignments } from "@/app/eventreihen/eventSeriesAccess.server";
import {
  canApproveScopedQuestion,
  canEditScopedQuestion,
  canRequestChangesForScopedQuestion,
  canUseQuestionScope,
  canViewScopedQuestion,
  type QuestionActorContext,
  type QuestionScopeAccessContext,
  type QuestionScopeValue,
} from "./questionScopePolicy";

export type QuestionCapability = "VIEW" | "EDIT" | "APPROVE" | "REQUEST_CHANGES";

function userIdFromSession(session: Session) {
  const userId = Number(session.user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export async function getQuestionActor(session?: Session): Promise<QuestionActorContext> {
  const currentSession = session ?? await requireSession();
  const assignments = await getCurrentEventSeriesAssignments(currentSession);
  return {
    globalRole: currentSession.user?.role,
    userId: userIdFromSession(currentSession),
    assignments: new Map(assignments.map((assignment) => [assignment.eventSeriesId, assignment.role])),
  };
}

export function mapQuestionAccessContext(question: {
  geltungsbereich: QuestionScopeValue;
  created_by_user_id: number | null;
  review_status: QuestionScopeAccessContext["reviewStatus"];
  ist_archiviert: boolean;
  freigegeben: boolean;
  eventreihen: { eventreihe_id: number }[];
}): QuestionScopeAccessContext {
  return {
    scope: question.geltungsbereich,
    eventSeriesIds: question.eventreihen.map((entry) => entry.eventreihe_id),
    createdByUserId: question.created_by_user_id,
    reviewStatus: question.review_status,
    isArchived: question.ist_archiviert,
    isApproved: question.freigegeben,
  };
}

export async function requireQuestionAccess(questionId: number, capability: QuestionCapability) {
  const session = await requireSession();
  const [actor, question] = await Promise.all([
    getQuestionActor(session),
    prisma.fragen.findUnique({
      where: { fragen_id: questionId },
      select: {
        fragen_id: true,
        geltungsbereich: true,
        created_by_user_id: true,
        review_status: true,
        ist_archiviert: true,
        freigegeben: true,
        eventreihen: { select: { eventreihe_id: true } },
      },
    }),
  ]);
  if (!question) throw new Error("Frage nicht gefunden oder Zugriff nicht erlaubt.");
  const context = mapQuestionAccessContext(question);
  const allowed = capability === "VIEW"
    ? canViewScopedQuestion(actor, context)
    : capability === "EDIT"
      ? canEditScopedQuestion(actor, context)
      : capability === "APPROVE"
        ? canApproveScopedQuestion(actor, context)
        : canRequestChangesForScopedQuestion(actor, context);
  if (!allowed) throw new Error("Frage nicht gefunden oder Zugriff nicht erlaubt.");
  return { session, actor, question, context };
}

export async function requireQuestionScopeSelection(
  scope: QuestionScopeValue,
  eventSeriesIds: number[],
  session?: Session,
) {
  const currentSession = session ?? await requireSession();
  const actor = await getQuestionActor(currentSession);
  const uniqueIds = [...new Set(eventSeriesIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (uniqueIds.length !== eventSeriesIds.length || !canUseQuestionScope(actor, scope, uniqueIds)) {
    throw new Error("Der gewählte Geltungsbereich ist nicht erlaubt.");
  }
  if (scope === "EVENT_SERIES") {
    const count = await prisma.eventreihen.count({
      where: { eventreihe_id: { in: uniqueIds }, ist_archiviert: false },
    });
    if (count !== uniqueIds.length) throw new Error("Mindestens eine Eventreihe ist ungültig oder archiviert.");
  }
  return { session: currentSession, actor, eventSeriesIds: uniqueIds };
}

export async function getAssignableQuestionEventSeries(session?: Session) {
  const currentSession = session ?? await requireSession();
  const actor = await getQuestionActor(currentSession);
  return prisma.eventreihen.findMany({
    where: {
      ist_archiviert: false,
      ...(actor.globalRole === "ADMIN" ? {} : { eventreihe_id: { in: [...actor.assignments.keys()] } }),
    },
    orderBy: { name: "asc" },
    select: { eventreihe_id: true, name: true },
  });
}
