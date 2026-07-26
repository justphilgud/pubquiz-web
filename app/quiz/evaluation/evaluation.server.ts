import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import { resolveQuizQuestionAnswerMode } from "@/app/quiz/quizQuestionAnswerMode";
import { prisma } from "@/app/lib/prisma";
import { evaluateBaseAnswer } from "./evaluateBaseAnswer";
import { evaluateQuestionPoints } from "./evaluateQuestionPoints";
import { getQuestionBaseMaximum } from "./questionPointPolicy";

type EvaluationDb = Prisma.TransactionClient | typeof prisma;

function orderingItems(config: Prisma.JsonValue | null) {
  const typed = config as QuestionTemplateConfig | null;
  return typed?.templateData?.kind === "ORDERING"
    ? typed.templateData.items.map((item) => item.id)
    : [];
}

export async function recalculateQuizQuestionEvaluation(
  quizQuestionId: number,
  db: EvaluationDb = prisma,
) {
  const assignment = await db.quiz_fragen.findUnique({
    where: { quiz_fragen_id: quizQuestionId },
    include: {
      quiz: {
        select: {
          _count: { select: { quiz_team_sessions: true } },
        },
      },
      fragen: {
        include: {
          vorlage: { select: { code: true } },
          antworten: { select: { antwort_id: true, ist_richtig: true } },
          antwortfelder: {
            orderBy: { sortierung: "asc" },
            include: {
              loesungen: {
                where: { ist_akzeptiert: true },
                orderBy: { sortierung: "asc" },
              },
            },
          },
        },
      },
      team_antworten: {
        include: {
          antwortauswahlen: true,
          antwortfelder: true,
        },
      },
    },
  });
  if (!assignment) throw new Error("Quizfrage nicht gefunden.");

  const templateId = assignment.fragen.vorlage?.code ?? null;
  const orderedItemIds = orderingItems(assignment.fragen.template_config_json);
  const maximum = getQuestionBaseMaximum({
    templateId,
    correctAnswerCount: assignment.fragen.antworten.filter((answer) => answer.ist_richtig).length,
    structuredFieldCount: assignment.fragen.antwortfelder.length,
    orderingItemCount: orderedItemIds.length,
  });
  const answerMode = resolveQuizQuestionAnswerMode({
    templateId,
    answers: assignment.fragen.antworten.map((answer) => ({
      isCorrect: answer.ist_richtig,
    })),
    allowFreeAnswer: assignment.freie_antwort_erlaubt,
  });

  const automatic = assignment.team_antworten.map((answer) => {
    const selectedAnswerIds =
      answer.antwortauswahlen.length > 0
        ? answer.antwortauswahlen.map((selection) => selection.antwort_id)
        : answer.antwort_id === null
          ? []
          : [answer.antwort_id];
    const structuredAnswers = new Map(
      answer.antwortfelder.map((field) => [
        field.antwortfeld_id,
        field.antwort_text,
      ]),
    );
    const base = evaluateBaseAnswer({
      templateId,
      effectiveAnswerMode: answerMode.effectiveMode,
      answerOptions: assignment.fragen.antworten.map((option) => ({
        id: option.antwort_id,
        isCorrect: option.ist_richtig,
      })),
      selectedAnswerIds,
      answerText: answer.antwort_text,
      structuredFields: assignment.fragen.antwortfelder.map((field) => ({
        id: field.antwortfeld_id,
        acceptedSolutions: field.loesungen.map((solution) => solution.loesung_text),
      })),
      structuredAnswers,
      orderingItems: orderedItemIds,
    });
    return { answer, result: evaluateQuestionPoints(base, assignment.punkte_modus) };
  });

  // Compatibility only: existing risk questions retain their former pool rule.
  const fullyCorrect = automatic.filter(({ result }) => result.status === "CORRECT").length;
  const legacyRiskPoints =
    assignment.punkte_modus === "risikofrage" && fullyCorrect > 0
      ? Prisma.Decimal.max(
          1,
          new Prisma.Decimal(assignment.quiz._count.quiz_team_sessions).div(fullyCorrect),
        )
      : new Prisma.Decimal(0);

  await db.quiz_fragen.update({
    where: { quiz_fragen_id: quizQuestionId },
    data: { punkte_basis: maximum },
  });

  for (const { answer, result } of automatic) {
    const autoFinal =
      assignment.punkte_modus === "risikofrage"
        ? result.status === "CORRECT"
          ? legacyRiskPoints
          : new Prisma.Decimal(0)
        : result.finalPoints;
    const preservesAwardedPoints =
      answer.bewertungsquelle === "MANUAL" ||
      answer.bewertungsquelle === "LEGACY";
    await db.team_antworten.update({
      where: { team_antwort_id: answer.team_antwort_id },
      data: {
        auto_basis_punkte: result.basePoints,
        auto_endpunkte: autoFinal,
        vergebene_punkte:
          preservesAwardedPoints
            ? answer.vergebene_punkte
            : autoFinal,
        bewertungsstatus: preservesAwardedPoints
          ? answer.bewertungsstatus
          : result.status,
        bewertungsquelle: answer.bewertungsquelle,
        bewertungsdetails: result.details,
      },
    });
  }

  const [correctAnswers, answered] = await Promise.all([
    db.team_antworten.count({
      where: {
        quiz_fragen_id: quizQuestionId,
        bewertungsstatus: "CORRECT",
      },
    }),
    db.team_antworten.count({
      where: {
        quiz_fragen_id: quizQuestionId,
        bewertungsstatus: { not: "UNANSWERED" },
      },
    }),
  ]);
  await db.quiz_fragen.update({
    where: { quiz_fragen_id: quizQuestionId },
    data: {
      richtigeantworten: correctAnswers,
      falscheantworten: answered - correctAnswers,
    },
  });
}

export async function recalculateQuizEvaluation(quizId: number) {
  const questions = await prisma.quiz_fragen.findMany({
    where: { quiz_id: quizId },
    select: { quiz_fragen_id: true },
  });
  for (const question of questions) {
    await recalculateQuizQuestionEvaluation(question.quiz_fragen_id);
  }
}
