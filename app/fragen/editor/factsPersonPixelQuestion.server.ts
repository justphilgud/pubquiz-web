import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { createDerivedPixelQuestion } from "./createDerivedPixelQuestion.server";
import { getQuestionTemplatePersistenceIds, questionTemplateIds } from "./templates/questionTemplateRegistry";
import type { FactsTemplateData } from "./templates/factsTemplate";

export const FACTS_PERSON_PIXEL_RELATION = "FACTS_PERSON_PIXEL";

export function readFactsPersonCreationIdentity(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const { factsPersonCreationRequestId, factsPersonCreationRequestHash } = value;
  if (typeof factsPersonCreationRequestId !== "string" || typeof factsPersonCreationRequestHash !== "string") return undefined;
  return { factsPersonCreationRequestId, factsPersonCreationRequestHash };
}

export async function findFactsPersonPixelChild(tx: Prisma.TransactionClient, questionId: number) {
  const relation = await tx.fragen_relationen.findUnique({
    where: { quell_fragen_id_typ_antwort_position: {
      quell_fragen_id: questionId, typ: FACTS_PERSON_PIXEL_RELATION, antwort_position: 1,
    } },
    select: { ziel_fragen_id: true },
  });
  return relation?.ziel_fragen_id ?? null;
}

// Called inside the source save transaction, after the source row is locked
// (update) or inserted (create). The derived question remains independently editable.
export async function ensureFactsPersonPixelChild(
  tx: Prisma.TransactionClient,
  questionId: number,
  userId: number,
  data: FactsTemplateData,
) {
  const parent = await tx.fragen.findUniqueOrThrow({
    where: { fragen_id: questionId },
    select: {
      geltungsbereich: true,
      eventreihen: { select: { eventreihe_id: true } },
      fragen_kategorien: { select: { fragenkategorie_id: true } },
      medien: {
        where: { slot_key: "facts_person_solution_image" },
        select: { datei: true, medientyp_id: true },
      },
    },
  });
  if (parent.medien.length !== 1 || !data.solution.trim()) return null;
  const existing = await findFactsPersonPixelChild(tx, questionId);
  if (existing !== null) return existing;
  const pixel = await tx.frage_vorlagen.findFirstOrThrow({
    where: { code: { in: [...getQuestionTemplatePersistenceIds(questionTemplateIds.pixelImage)] } },
    orderBy: { vorlage_id: "asc" },
    select: { vorlage_id: true },
  });
  const medium = parent.medien[0];
  const child = await createDerivedPixelQuestion(tx, pixel.vorlage_id, userId, parent, {
    imageUrl: medium.datei,
    mediaTypeId: medium.medientyp_id,
    solutions: [data.solution, ...data.acceptedVariants].map((text) => ({ text: text.trim(), additionalInfo: null })),
  });
  await tx.fragen_relationen.create({ data: {
    quell_fragen_id: questionId, ziel_fragen_id: child.fragen_id,
    typ: FACTS_PERSON_PIXEL_RELATION, antwort_position: 1,
  } });
  return child.fragen_id;
}
