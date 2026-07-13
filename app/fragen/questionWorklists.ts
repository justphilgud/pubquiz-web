import { prisma } from "@/app/lib/prisma";
import {
  QuestionReviewStatus,
  type QuestionReviewStatus as QuestionReviewStatusType,
} from "@/app/generated/prisma/enums";
import type { QuestionWorklistEntry } from "./components/QuestionWorklist";

const OWN_WORKLIST_LIMIT = 20;
const REVIEW_QUEUE_LIMIT = 50;

const worklistSelect = {
  fragen_id: true,
  frage: true,
  review_status: true,
  updated_at: true,
  submitted_at: true,
  reviewed_at: true,
  review_feedback: true,
  fragen_kategorien: {
    select: {
      fragenkategorie: {
        select: { kategorie: true },
      },
    },
  },
} as const;

function toWorklistEntry(
  question: Awaited<ReturnType<typeof loadQuestionsByStatus>>[number],
  status: QuestionReviewStatusType,
): QuestionWorklistEntry {
  const timestamp =
    status === QuestionReviewStatus.DRAFT
      ? question.updated_at
      : status === QuestionReviewStatus.IN_REVIEW
        ? question.submitted_at
        : question.reviewed_at;

  return {
    id: question.fragen_id,
    text: question.frage,
    status: question.review_status,
    categories: question.fragen_kategorien.map(
      ({ fragenkategorie }) => fragenkategorie.kategorie,
    ),
    timestamp,
    reviewFeedback: question.review_feedback,
  };
}

function loadQuestionsByStatus(
  userId: number,
  status: QuestionReviewStatusType,
) {
  return prisma.fragen.findMany({
    where: {
      created_by_user_id: userId,
      review_status: status,
      ist_archiviert: false,
    },
    orderBy: { updated_at: "desc" },
    take: OWN_WORKLIST_LIMIT,
    select: worklistSelect,
  });
}

export async function loadOwnQuestionWorklists(userId: number) {
  const [drafts, submitted, changesRequested] = await Promise.all([
    loadQuestionsByStatus(userId, QuestionReviewStatus.DRAFT),
    loadQuestionsByStatus(userId, QuestionReviewStatus.IN_REVIEW),
    loadQuestionsByStatus(userId, QuestionReviewStatus.CHANGES_REQUESTED),
  ]);

  return {
    drafts: drafts.map((question) =>
      toWorklistEntry(question, QuestionReviewStatus.DRAFT),
    ),
    submitted: submitted.map((question) =>
      toWorklistEntry(question, QuestionReviewStatus.IN_REVIEW),
    ),
    changesRequested: changesRequested.map((question) =>
      toWorklistEntry(question, QuestionReviewStatus.CHANGES_REQUESTED),
    ),
  };
}

export type ReviewQueueEntry = {
  id: number;
  text: string;
  source: string | null;
  creatorName: string;
  submittedAt: Date | null;
  categories: string[];
};

export async function loadReviewQueue(): Promise<ReviewQueueEntry[]> {
  const questions = await prisma.fragen.findMany({
    where: {
      review_status: QuestionReviewStatus.IN_REVIEW,
      ist_archiviert: false,
    },
    orderBy: [{ submitted_at: "asc" }, { updated_at: "asc" }],
    take: REVIEW_QUEUE_LIMIT,
    select: {
      fragen_id: true,
      frage: true,
      quelle: true,
      created_by_user_id: true,
      submitted_at: true,
      fragen_kategorien: {
        select: {
          fragenkategorie: { select: { kategorie: true } },
        },
      },
    },
  });
  const creatorIds = [
    ...new Set(
      questions
        .map((question) => question.created_by_user_id)
        .filter((id): id is number => id !== null),
    ),
  ];
  const creators = creatorIds.length
    ? await prisma.users.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const creatorNames = new Map(
    creators.map((creator) => [
      creator.id,
      creator.name?.trim() || creator.email,
    ]),
  );

  return questions.map((question) => ({
    id: question.fragen_id,
    text: question.frage,
    source: question.quelle?.trim() || null,
    creatorName:
      (question.created_by_user_id !== null
        ? creatorNames.get(question.created_by_user_id)
        : null) ?? "Unbekannt",
    submittedAt: question.submitted_at,
    categories: question.fragen_kategorien.map(
      ({ fragenkategorie }) => fragenkategorie.kategorie,
    ),
  }));
}
