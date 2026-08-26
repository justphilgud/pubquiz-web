import "server-only";

import { prisma } from "@/app/lib/prisma";

export async function loadPublicQuestionSubmissionReviewMetadata(
  questionId: number,
  includeContact: boolean,
) {
  if (includeContact) {
    const submission = await prisma.public_question_submissions.findUnique({
        where: { fragen_id: questionId },
        select: {
          created_at: true,
          submitter_name: true,
          submitter_email: true,
        },
      });
    if (!submission) return null;
    return {
      origin: "PUBLIC" as const,
      submittedAt: submission.created_at.toISOString(),
      contact: {
        name: submission.submitter_name,
        email: submission.submitter_email,
      },
    };
  }
  const submission = await prisma.public_question_submissions.findUnique({
    where: { fragen_id: questionId },
    select: { created_at: true },
  });
  if (!submission) return null;
  return {
    origin: "PUBLIC" as const,
    submittedAt: submission.created_at.toISOString(),
    contact: null,
  };
}
