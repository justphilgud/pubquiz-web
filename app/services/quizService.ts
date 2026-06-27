import type { Session } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { canAssignQuestionsToQuiz } from "@/app/lib/permissions";

type QuizQuestionCreateData = Parameters<
  typeof prisma.quiz_fragen.create
>[0]["data"];

type QuizDb = Pick<typeof prisma, "fragen" | "quiz_fragen">;

export async function addQuestionToQuiz(
  data: QuizQuestionCreateData,
  session: Session,
  db: QuizDb = prisma,
) {
  if (!canAssignQuestionsToQuiz(session)) {
    throw new Error("Keine Berechtigung, Fragen einem Quiz hinzuzufügen.");
  }

  const frage = await db.fragen.findUnique({
    where: { fragen_id: data.fragen_id },
    select: { freigegeben: true },
  });

  if (!frage?.freigegeben) {
    throw new Error(
      "Diese Frage ist noch nicht freigegeben und kann keinem Quiz hinzugefügt werden.",
    );
  }

  return db.quiz_fragen.create({
    data,
  });
}
