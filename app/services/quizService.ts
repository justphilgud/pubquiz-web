import type { Session } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { FACE_MORPH_PIXEL_RELATION_TYPE } from "@/app/fragen/editor/faceMorphPixelQuestionPlan";
import { getBerlinDate } from "@/app/lib/berlinDate";
import { buildQuestionEligibilityWhere } from "@/app/fragen/editor/questionEligibility.server";
import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import { getQuestionBaseMaximum } from "@/app/quiz/evaluation/questionPointPolicy";
import { createQuizSpecificOrderingItemOrder } from "@/app/quiz/orderingQuestionOrder";

type QuizQuestionCreateData = Parameters<
  typeof prisma.quiz_fragen.create
>[0]["data"];

type QuizDb = Pick<typeof prisma, "fragen" | "fragen_relationen" | "quiz" | "quiz_fragen">;

export async function addQuestionToQuiz(
  data: QuizQuestionCreateData,
  session: Session,
  db: QuizDb = prisma,
) {
  void session;
  const quiz = await db.quiz.findUnique({
    where: { quiz_id: data.quiz_id },
    select: { eventreihe_id: true },
  });
  if (!quiz) throw new Error("Quiz nicht gefunden.");
  const frage = await db.fragen.findFirst({
    where: {
      fragen_id: data.fragen_id,
      ...buildQuestionEligibilityWhere(quiz.eventreihe_id, getBerlinDate()),
    },
    select: {
      fragen_id: true,
      template_config_json: true,
      vorlage: { select: { code: true } },
      antworten: { select: { ist_richtig: true } },
      antwortfelder: { select: { antwortfeld_id: true } },
    },
  });
  if (!frage) {
    throw new Error(
      "Diese Frage ist für die Eventreihe des Quiz nicht freigegeben oder nicht mehr verfügbar.",
    );
  }

  const relations = await db.fragen_relationen.findMany({
    where: {
      typ: FACE_MORPH_PIXEL_RELATION_TYPE,
      ist_aktiv: true,
      OR: [
        { quell_fragen_id: data.fragen_id },
        { ziel_fragen_id: data.fragen_id },
      ],
    },
    select: { quell_fragen_id: true, ziel_fragen_id: true },
  });
  const counterpartIds = relations.map((relation) =>
    relation.quell_fragen_id === data.fragen_id
      ? relation.ziel_fragen_id
      : relation.quell_fragen_id,
  );
  const coupledQuestionAlreadyInQuiz = counterpartIds.length > 0
    ? (await db.quiz_fragen.count({
        where: {
          quiz_id: data.quiz_id,
          fragen_id: { in: counterpartIds },
        },
      })) > 0
    : false;

  const config = frage.template_config_json as QuestionTemplateConfig | null;
  const orderingItemCount =
    config?.templateData?.kind === "ORDERING"
      ? config.templateData.items.length
      : 0;
  const suppliedAnswerOrder = Array.isArray(data.antwort_reihenfolge)
    ? data.antwort_reihenfolge
    : null;
  const answerOrder =
    orderingItemCount > 0 && (!suppliedAnswerOrder || suppliedAnswerOrder.length === 0)
      ? createQuizSpecificOrderingItemOrder(orderingItemCount)
      : data.antwort_reihenfolge;
  const assignment = await db.quiz_fragen.create({
    data: {
      ...data,
      antwort_reihenfolge: answerOrder,
      punkte_basis: getQuestionBaseMaximum({
        templateId: frage.vorlage?.code ?? null,
        correctAnswerCount: frage.antworten.filter((answer) => answer.ist_richtig).length,
        structuredFieldCount: frage.antwortfelder.length,
        orderingItemCount,
      }),
    },
  });

  return { ...assignment, coupledQuestionAlreadyInQuiz };
}
