import type { Prisma } from "@/app/generated/prisma/client";

import type { ExternalImportPlanItem } from "./productionImportGuard";

export type ExternalQuestionRecordInput = Readonly<{
  operatorUserId: number;
  sourceType: string;
  externalReference: string;
  prepared: ExternalImportPlanItem["prepared"];
  verificationSources: ExternalImportPlanItem["verification"]["sources"];
  license: ExternalImportPlanItem["license"];
  suggestedCategoryId?: number | null;
}>;

function attribution(input: ExternalQuestionRecordInput) {
  const sources = input.verificationSources.map((source) => `${source.title}: ${source.url}`);
  sources.push(
    `Adaptiert/übersetzt aus ${input.sourceType} (${input.externalReference}), ${input.license.name}: ${input.license.url}`,
  );
  return sources.join(" · ").slice(0, 1_000);
}

export async function createExternalQuestionRecord(
  transaction: Prisma.TransactionClient,
  input: ExternalQuestionRecordInput,
) {
  if (input.prepared.distractors.length !== 3) {
    throw new Error("EXTERNAL_IMPORT_ANSWERS_INVALID");
  }
  const answerKeys = [input.prepared.correctAnswer, ...input.prepared.distractors]
    .map((answer) => answer.trim().toLocaleLowerCase("de"));
  if (answerKeys.some((answer) => !answer) || new Set(answerKeys).size !== 4) {
    throw new Error("EXTERNAL_IMPORT_ANSWERS_INVALID");
  }
  const answerType = await transaction.antworttyp.findFirst({
    where: { antworttyp: { equals: "Standard", mode: "insensitive" } },
    select: { antworttyp_id: true },
  });
  if (!answerType) throw new Error("STANDARD_ANSWER_TYPE_MISSING");

  const category = input.suggestedCategoryId
    ? { fragenkategorie_id: input.suggestedCategoryId }
    : input.prepared.category
      ? await transaction.fragenkategorie.findFirst({
          where: {
            kategorie: { equals: input.prepared.category, mode: "insensitive" },
            status: "ACTIVE",
          },
          select: { fragenkategorie_id: true },
        })
      : null;
  const now = new Date();
  return transaction.fragen.create({
    data: {
      frage: input.prepared.question,
      quelle: attribution(input),
      fragentyp: "Multiple Choice",
      schwierigkeitslevel: input.prepared.difficulty,
      created_by_user_id: input.operatorUserId,
      last_modified_by_user_id: input.operatorUserId,
      freigegeben: false,
      ist_unfertig: false,
      review_status: "IN_REVIEW",
      submitted_at: now,
      submitted_by_user_id: input.operatorUserId,
      moderationsnotizen: input.prepared.explanation,
      kategorienwunsch: category ? null : input.prepared.category,
      antworten: {
        create: [
          {
            antwort: input.prepared.correctAnswer,
            ist_richtig: true,
            antworttyp_id: answerType.antworttyp_id,
          },
          ...input.prepared.distractors.map((answer) => ({
            antwort: answer,
            ist_richtig: false,
            antworttyp_id: answerType.antworttyp_id,
          })),
        ],
      },
      ...(category
        ? {
            fragen_kategorien: {
              create: { fragenkategorie_id: category.fragenkategorie_id },
            },
          }
        : {}),
    },
    select: { fragen_id: true },
  });
}
