import type { Session } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { canAssignQuestionsToQuiz } from "@/app/lib/permissions";
import { FACE_MORPH_PIXEL_RELATION_TYPE } from "@/app/fragen/editor/faceMorphPixelQuestionPlan";
import { getBerlinDate } from "@/app/lib/berlinDate";

type QuizQuestionCreateData = Parameters<
  typeof prisma.quiz_fragen.create
>[0]["data"];

type QuizDb = Pick<typeof prisma, "fragen" | "fragen_relationen" | "quiz_fragen">;

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
    select: { freigegeben: true, gueltig_bis: true },
  });

  if (!frage?.freigegeben) {
    throw new Error(
      "Diese Frage ist noch nicht freigegeben und kann keinem Quiz hinzugefügt werden.",
    );
  }
  if (frage.gueltig_bis && frage.gueltig_bis < getBerlinDate()) {
    throw new Error("Diese Frage ist abgelaufen und kann keinem neuen Quiz hinzugefügt werden.");
  }

  const relations = await db.fragen_relationen.findMany({
    where: {
      typ: FACE_MORPH_PIXEL_RELATION_TYPE,
      ist_aktiv: true,
      OR: [
        { quell_fragen_id: data.fragen_id },
        { ziel_fragen_id: data.fragen_id },
      ],
    },
    select: { quell_fragen_id: true, ziel_fragen_id: true },
  });
  const counterpartIds = relations.map((relation) =>
    relation.quell_fragen_id === data.fragen_id
      ? relation.ziel_fragen_id
      : relation.quell_fragen_id,
  );
  const coupledQuestionAlreadyInQuiz = counterpartIds.length > 0
    ? (await db.quiz_fragen.count({
        where: {
          quiz_id: data.quiz_id,
          fragen_id: { in: counterpartIds },
        },
      })) > 0
    : false;

  const assignment = await db.quiz_fragen.create({
    data,
  });

  return { ...assignment, coupledQuestionAlreadyInQuiz };
}
