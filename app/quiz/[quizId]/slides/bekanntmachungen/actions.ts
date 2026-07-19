"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireQuizEditor } from "@/app/quiz/quizAccess.server";

export async function saveBekanntmachungen(formData: FormData) {
  const quizId = Number(formData.get("quizId"));
  await requireQuizEditor(quizId);

  const bekanntmachungen =
    formData.get("bekanntmachungen")?.toString() ?? "";

  await prisma.quiz.update({
    where: {
      quiz_id: quizId,
    },
    data: {
      outro_bekanntmachungen:
        bekanntmachungen.trim() === ""
          ? null
          : bekanntmachungen.trim(),
    },
  });

  redirect(`/quiz/${quizId}/slides/bekanntmachungen`);
}
