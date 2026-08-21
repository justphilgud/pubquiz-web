import "server-only";

import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import { prisma } from "@/app/lib/prisma";
import { repairQuizSpecificOrderingAnswerIdOrders } from "./orderingQuestionOrder";

type OrderingRepairDb = Pick<typeof prisma, "quiz_fragen">;

export async function repairQuizSpecificOrderingAssignments(
  quizId: number,
  db: OrderingRepairDb = prisma,
) {
  const assignments = await db.quiz_fragen.findMany({
    where: { quiz_id: quizId },
    select: {
      quiz_fragen_id: true,
      antwort_reihenfolge: true,
      fragen: {
        select: {
          template_config_json: true,
          antworten: {
            orderBy: { antwort_id: "asc" },
            select: { antwort_id: true },
          },
        },
      },
    },
  });
  const orderingAssignments = assignments.flatMap((assignment) => {
    const config = assignment.fragen.template_config_json as
      | QuestionTemplateConfig
      | null;
    if (config?.templateData?.kind !== "ORDERING") return [];
    if (assignment.fragen.antworten.length !== config.templateData.items.length) {
      throw new Error(
        `Ordering-Frage ${assignment.quiz_fragen_id} hat inkonsistente Antwortdaten.`,
      );
    }
    return [
      {
        quizFragenId: assignment.quiz_fragen_id,
        canonicalAnswerIds: assignment.fragen.antworten.map(
          (answer) => answer.antwort_id,
        ),
        storedOrder: assignment.antwort_reihenfolge,
      },
    ];
  });
  return repairQuizSpecificOrderingAnswerIdOrders(
    orderingAssignments,
    async ({ quizFragenId, expectedOrder, nextOrder }) => {
      const updated = await db.quiz_fragen.updateMany({
        where: {
          quiz_fragen_id: quizFragenId,
          antwort_reihenfolge: { equals: [...expectedOrder] },
        },
        data: { antwort_reihenfolge: [...nextOrder] },
      });
      return updated.count === 1;
    },
  );
}
