import "server-only";

import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import { prisma } from "@/app/lib/prisma";
import { resolveQuizSpecificOrderingItemOrder } from "./orderingQuestionOrder";

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
      fragen: { select: { template_config_json: true } },
    },
  });
  let repairedAssignments = 0;
  for (const assignment of assignments) {
    const config = assignment.fragen.template_config_json as
      | QuestionTemplateConfig
      | null;
    if (config?.templateData?.kind !== "ORDERING") continue;
    const resolved = resolveQuizSpecificOrderingItemOrder(
      config.templateData.items.length,
      assignment.antwort_reihenfolge,
    );
    if (!resolved.needsRepair) continue;
    const updated = await db.quiz_fragen.updateMany({
      where: {
        quiz_fragen_id: assignment.quiz_fragen_id,
        antwort_reihenfolge: { equals: assignment.antwort_reihenfolge },
      },
      data: { antwort_reihenfolge: resolved.order },
    });
    repairedAssignments += updated.count;
  }
  return repairedAssignments;
}
