"use server";

import { revalidatePath } from "next/cache";

import { requireQuizLiveController } from "@/app/quiz/quizAccess.server";
import { getMemePresentationSnapshot } from "@/app/quiz/memeVoting.server";
import { finalizeMemeResult } from "@/app/quiz/memeResults.server";

function requirePositiveId(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} ist ungültig.`);
  }
}

export async function finalizeMemeResultAction(input: {
  quizId: number;
  quizFragenId: number;
  presentationId: number;
}) {
  requirePositiveId(input.quizId, "Quiz-ID");
  requirePositiveId(input.quizFragenId, "Quizfragen-ID");
  requirePositiveId(input.presentationId, "Präsentations-ID");
  const access = await requireQuizLiveController(input.quizId);
  const result = await finalizeMemeResult({
    ...input,
    actorUserId: Number(access.session.user.id),
  });
  revalidatePath(`/quiz/${input.quizId}/moderation`);
  revalidatePath(`/quiz/${input.quizId}/praesentation`);
  revalidatePath(`/quiz/${input.quizId}/auswertung`);
  return {
    ...result,
    view: await getMemePresentationSnapshot({
      quizId: input.quizId,
      quizFragenId: input.quizFragenId,
      includeModeration: true,
      includeResult: true,
    }),
  };
}
