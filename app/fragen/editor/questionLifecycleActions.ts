"use server";

import { revalidatePath } from "next/cache";
import { getBerlinDate } from "@/app/lib/berlinDate";
import { requireQuestionEditor } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUserId } from "@/app/services/questionService";
import { getQuestionActor, mapQuestionAccessContext } from "./questionAccess.server";
import { isValidNextReviewFrom } from "./questionLifecycle";
import { canEditScopedQuestion } from "./questionScopePolicy";

type ConfirmFreshnessResult =
  | { ok: true; nextReviewFrom: string | null; updatedAt: string }
  | { ok: false; code: "INVALID_DATE" | "NOT_FOUND" | "PERMISSION_DENIED" | "CONFLICT" };

export async function confirmQuestionFreshness(input: {
  questionId: number;
  nextReviewFrom: string | null;
  expectedUpdatedAt: string;
}): Promise<ConfirmFreshnessResult> {
  const session = await requireQuestionEditor();
  if (!Number.isInteger(input.questionId) || input.questionId <= 0) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (!isValidNextReviewFrom(
    input.nextReviewFrom,
    getBerlinDate().toISOString().slice(0, 10),
  )) {
    return { ok: false, code: "INVALID_DATE" };
  }
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    return { ok: false, code: "CONFLICT" };
  }

  const question = await prisma.fragen.findUnique({
    where: { fragen_id: input.questionId },
    select: {
      created_by_user_id: true,
      review_status: true,
      ist_archiviert: true,
      freigegeben: true,
      geltungsbereich: true,
      eventreihen: { select: { eventreihe_id: true } },
      pruefen_ab: true,
    },
  });
  if (!question || question.pruefen_ab === null) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const actor = await getQuestionActor(session);
  if (!canEditScopedQuestion(actor, mapQuestionAccessContext(question))) {
    return { ok: false, code: "PERMISSION_DENIED" };
  }

  const updated = await prisma.fragen.updateMany({
    where: { fragen_id: input.questionId, updated_at: expectedUpdatedAt },
    data: {
      pruefen_ab: input.nextReviewFrom
        ? new Date(`${input.nextReviewFrom}T00:00:00.000Z`)
        : null,
      aktualitaet_geprueft_am: new Date(),
      aktualitaet_geprueft_von_user_id: getCurrentUserId(session),
      last_modified_by_user_id: getCurrentUserId(session),
    },
  });
  if (updated.count !== 1) return { ok: false, code: "CONFLICT" };

  const row = await prisma.fragen.findUniqueOrThrow({
    where: { fragen_id: input.questionId },
    select: { updated_at: true },
  });
  revalidatePath("/content");
  revalidatePath("/fragen");
  revalidatePath(`/content/questions/${input.questionId}`);
  return {
    ok: true,
    nextReviewFrom: input.nextReviewFrom,
    updatedAt: row.updated_at.toISOString(),
  };
}
