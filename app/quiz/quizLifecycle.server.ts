import type { Prisma } from "@/app/generated/prisma/client";
import { resolveQuizLifecycle } from "./quizLifecycle";

// Lock order: quiz -> interaction run -> draft. Also locks quizzes without status.
export async function lockQuizLifecycle(tx: Prisma.TransactionClient, quizId: number) {
  await tx.$queryRaw`SELECT "quiz_id" FROM "pubquiz"."quiz" WHERE "quiz_id" = ${quizId} FOR UPDATE`;
  return tx.quiz_praesentation_status.upsert({
    where: { quiz_id: quizId }, update: {}, create: { quiz_id: quizId },
  });
}

export async function requireQuizNotStopped(tx: Prisma.TransactionClient, quizId: number) {
  const status = await lockQuizLifecycle(tx, quizId);
  if (resolveQuizLifecycle(status) === "STOPPED") {
    throw new Error("Das Quiz ist beendet. Für einen neuen Durchlauf bitte zurücksetzen.");
  }
  return status;
}

export const RESET_PRESENTATION_DATA = {
  slide_index: 0,
  slide_key: null,
  quiz_started_at: null,
  quiz_stopped_at: null,
  audio_aktion: "stop",
  countdown_dauer_sekunden: null,
  countdown_started_at: null,
  countdown_ended_at: null,
  countdown_status: "idle",
  medium_overlay_aktiv: false,
  endstand_reveal_count: 1,
  show_schaetzfrage: false,
  zeige_schaetzantwort: false,
  schaetzfrage_id: null,
} as const;
