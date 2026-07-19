import "server-only";

import type { Session } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import { buildQuizOwnershipContext } from "./quizOwnershipPolicy";

export type QuizCapability = "VIEW" | "EDIT" | "ADMIN" | "CONTROL_LIVE";

export type QuizAuthorizationContext = {
  session: Session;
  capability: QuizCapability;
  quiz: {
    quiz_id: number;
    ist_archiviert: boolean;
  };
  ownership: {
    ownerUserId: number | null;
    eventSeriesId: number | null;
  };
};

function capabilityAllowsArchivedQuiz(capability: QuizCapability) {
  return capability === "VIEW" || capability === "ADMIN";
}

export async function requireQuizAccess(
  quizId: number,
  capability: QuizCapability,
): Promise<QuizAuthorizationContext> {
  const session = await requireAdmin();
  const quiz = await prisma.quiz.findUnique({
    where: { quiz_id: quizId },
    select: { quiz_id: true, ist_archiviert: true, eventreihe_id: true },
  });

  if (!quiz) {
    throw new Error("Quiz nicht gefunden.");
  }

  if (quiz.ist_archiviert && !capabilityAllowsArchivedQuiz(capability)) {
    throw new Error("Archivierte Quizze können nicht verändert oder gesteuert werden.");
  }

  return {
    session,
    capability,
    quiz,
    ownership: buildQuizOwnershipContext(quiz.eventreihe_id),
  };
}

export function requireQuizViewer(quizId: number) {
  return requireQuizAccess(quizId, "VIEW");
}

export function requireQuizEditor(quizId: number) {
  return requireQuizAccess(quizId, "EDIT");
}

export function requireQuizAdmin(quizId: number) {
  return requireQuizAccess(quizId, "ADMIN");
}

export function requireQuizLiveController(quizId: number) {
  return requireQuizAccess(quizId, "CONTROL_LIVE");
}

export function requireQuizOwnership(
  quizId: number,
  capability: QuizCapability = "EDIT",
) {
  return requireQuizAccess(quizId, capability);
}

export async function requireQuizSection(quizId: number, quizSectionId: number) {
  const section = await prisma.quiz_abschnitte.findFirst({
    where: {
      quiz_id: quizId,
      quiz_abschnitt_id: quizSectionId,
    },
  });

  if (!section) {
    throw new Error("Quizabschnitt gehört nicht zu diesem Quiz.");
  }

  return section;
}

export async function requireQuizQuestion(quizId: number, quizQuestionId: number) {
  const quizQuestion = await prisma.quiz_fragen.findFirst({
    where: {
      quiz_id: quizId,
      quiz_fragen_id: quizQuestionId,
    },
  });

  if (!quizQuestion) {
    throw new Error("Quizfrage gehört nicht zu diesem Quiz.");
  }

  return quizQuestion;
}

export async function requireQuizQuestionInSection(
  quizId: number,
  quizSectionId: number,
  quizQuestionId: number,
) {
  const quizQuestion = await prisma.quiz_fragen.findFirst({
    where: {
      quiz_id: quizId,
      quiz_abschnitt_id: quizSectionId,
      quiz_fragen_id: quizQuestionId,
    },
  });

  if (!quizQuestion) {
    throw new Error("Quizfrage gehört nicht zu diesem Quizabschnitt.");
  }

  return quizQuestion;
}

export async function requireQuizTeamAnswer(quizId: number, teamAnswerId: number) {
  const teamAnswer = await prisma.team_antworten.findFirst({
    where: {
      quiz_id: quizId,
      team_antwort_id: teamAnswerId,
    },
  });

  if (!teamAnswer) {
    throw new Error("Teamantwort gehört nicht zu diesem Quiz.");
  }

  return teamAnswer;
}
