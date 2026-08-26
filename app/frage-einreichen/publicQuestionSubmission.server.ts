import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import type {
  PublicQuestionSubmissionRepository,
  ValidPublicQuestionSubmission,
} from "./publicQuestionSubmission";

function getWindowStart(now: Date) {
  const windowStart = new Date(now);
  windowStart.setUTCMinutes(0, 0, 0);
  return windowStart;
}

async function consumeRateLimit(input: {
  fingerprint: string;
  now: Date;
  maximum: number;
}) {
  const windowStart = getWindowStart(input.now);
  return prisma.$transaction(async (tx) => {
    await tx.public_question_rate_limits.upsert({
      where: {
        request_fingerprint_window_start: {
          request_fingerprint: input.fingerprint,
          window_start: windowStart,
        },
      },
      create: {
        request_fingerprint: input.fingerprint,
        window_start: windowStart,
        request_count: 0,
      },
      update: {},
    });
    const updated = await tx.public_question_rate_limits.updateMany({
      where: {
        request_fingerprint: input.fingerprint,
        window_start: windowStart,
        request_count: { lt: input.maximum },
      },
      data: { request_count: { increment: 1 } },
    });
    return updated.count === 1;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function createPendingQuestion(
  input: ValidPublicQuestionSubmission,
  now: Date,
) {
  return prisma.$transaction(async (tx) => {
    const answerType = await tx.antworttyp.findFirst({
      where: { antworttyp: { equals: "Standard", mode: "insensitive" } },
      select: { antworttyp_id: true },
    });
    if (!answerType) throw new Error("Der Standard-Antworttyp ist nicht konfiguriert.");
    const question = await tx.fragen.create({
      data: {
      frage: input.question,
      quelle: input.sourceUrl || null,
      fragentyp: "STANDARD",
      ist_archiviert: false,
      ist_unfertig: false,
      freigegeben: false,
      review_status: "IN_REVIEW",
      submitted_at: now,
      submitted_by_user_id: null,
      created_by_user_id: null,
      geltungsbereich: "GLOBAL",
      antworten: {
        create: {
          antwort: input.answer,
          ist_richtig: true,
          zusatzinformation: input.explanation || null,
          antworttyp_id: answerType.antworttyp_id,
        },
      },
      public_submission: {
        create: {
          submitter_name: input.submitterName || null,
          submitter_email: input.submitterEmail || null,
          created_at: now,
        },
      },
      },
      select: { fragen_id: true },
    });
    return question.fragen_id;
  });
}

export const publicQuestionSubmissionRepository: PublicQuestionSubmissionRepository = {
  consumeRateLimit,
  createPendingQuestion,
};
