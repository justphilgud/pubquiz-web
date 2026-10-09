import type { Prisma } from "@/app/generated/prisma/client";
import { loadQuestionForEditor } from "./questionEditorData";
import { questionStatusUpdate, type QuestionStatusTarget } from "./questionStatus";
import type { QuestionActorContext } from "./questionScopePolicy";
import type { QuestionEditorDraft } from "./types";

/** Caller supplies a transaction and the existing complete-content validator. */
export async function transitionStoredQuestionStatus(tx: Prisma.TransactionClient, actor: QuestionActorContext,
  input: { questionId: number; target: QuestionStatusTarget; expectedUpdatedAt: string },
  validate: (draft: QuestionEditorDraft) => Promise<void>) {
  await tx.$queryRaw`SELECT fragen_id FROM pubquiz.fragen WHERE fragen_id = ${input.questionId} FOR UPDATE`;
  const stored = await loadQuestionForEditor(input.questionId, tx);
  if (!stored || stored.record.updatedAt !== input.expectedUpdatedAt) throw new Error("STALE_QUESTION");
  const update = questionStatusUpdate(actor, stored.access, input.target);
  if (input.target === "APPROVED") await validate(stored.draft);
  await tx.fragen.update({ where: { fragen_id: input.questionId }, data: update });
}
