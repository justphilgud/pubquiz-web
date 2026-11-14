import type { Prisma } from "@/app/generated/prisma/client";
import { getQuestionTemplatePersistenceIds, questionTemplateIds } from "./templates/questionTemplateRegistry";

export const classicQuestionTemplateWhere = {
  OR: [
    { vorlage: null },
    { vorlage: { code: { in: [questionTemplateIds.standard, ...getQuestionTemplatePersistenceIds(questionTemplateIds.multipleChoice)] } } },
  ],
} satisfies Prisma.fragenWhereInput;

export const questionTextSimilarityWhere = {
  source_vorlage_id: null,
  ...classicQuestionTemplateWhere,
} satisfies Prisma.fragenWhereInput;
