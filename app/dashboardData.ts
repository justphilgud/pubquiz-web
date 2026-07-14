import "server-only";

import type { QuestionReviewStatus } from "@/app/generated/prisma/enums";
import { prisma } from "@/app/lib/prisma";

const DASHBOARD_LIST_LIMIT = 5;
const UPCOMING_QUIZ_LIMIT = 3;
const BERLIN_TIME_ZONE = "Europe/Berlin";

export type DashboardQuestionItem = {
  id: number;
  text: string;
  status: QuestionReviewStatus;
  timestamp: Date | null;
  reviewFeedback: string | null;
  missingSource: boolean;
  missingCategory: boolean;
  creatorName: string | null;
};

export type EditorDashboardData = {
  counts: {
    changesRequested: number;
    drafts: number;
    inReview: number;
    approved: number;
    createdThisWeek: number;
    approvedThisWeek: number;
  };
  tasks: DashboardQuestionItem[];
  lastEdited: DashboardQuestionItem | null;
};

export type AdminQuestionDashboardData = {
  counts: {
    awaitingReview: number;
    approved: number;
    drafts: number;
    changesRequested: number;
    outdated: number;
    missingSource: number;
    missingCategory: number;
    approvedWithSource: number;
    createdThisWeek: number;
    approvedThisWeek: number;
  };
  reviewQueue: DashboardQuestionItem[];
};

export type DashboardQuizItem = {
  id: number;
  title: string;
  date: Date;
  daysUntil: number;
  questionCount: number;
  teamCount: number;
};

export type AdminQuizDashboardData = {
  upcomingQuizzes: DashboardQuizItem[];
};

export type AdminUserDashboardData = {
  activeUsers: number;
  editors: number;
  admins: number;
  passwordChangeRequired: number;
  inactiveUsers: number;
};

const questionSelect = {
  fragen_id: true,
  frage: true,
  review_status: true,
  updated_at: true,
  submitted_at: true,
  reviewed_at: true,
  review_feedback: true,
  quelle: true,
  created_by_user_id: true,
  fragen_kategorien: {
    select: { fragenkategorie_id: true },
  },
} as const;

type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

function getBerlinDateParts(now = new Date()): CalendarDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function toDatabaseDate(parts: CalendarDateParts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function getBerlinOffsetMilliseconds(date: Date) {
  const offsetLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: BERLIN_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = offsetLabel?.match(/^GMT([+-])(\d{2}):(\d{2})$/);

  if (!match) return 0;

  const direction = match[1] === "+" ? 1 : -1;
  return direction * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

function toBerlinStartOfDay(parts: CalendarDateParts) {
  const utcGuess = toDatabaseDate(parts);
  return new Date(utcGuess.getTime() - getBerlinOffsetMilliseconds(utcGuess));
}

function startOfCurrentBerlinWeek(now = new Date()) {
  const current = getBerlinDateParts(now);
  const calendarDate = toDatabaseDate(current);
  const dayOfWeek = calendarDate.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  calendarDate.setUTCDate(calendarDate.getUTCDate() - daysSinceMonday);

  return toBerlinStartOfDay({
    year: calendarDate.getUTCFullYear(),
    month: calendarDate.getUTCMonth() + 1,
    day: calendarDate.getUTCDate(),
  });
}

function timestampForStatus(question: {
  review_status: QuestionReviewStatus;
  updated_at: Date;
  submitted_at: Date | null;
  reviewed_at: Date | null;
}) {
  if (question.review_status === "IN_REVIEW") {
    return question.submitted_at ?? question.updated_at;
  }

  if (question.review_status === "CHANGES_REQUESTED") {
    return question.reviewed_at ?? question.updated_at;
  }

  return question.updated_at;
}

function toQuestionItem(
  question: {
    fragen_id: number;
    frage: string;
    review_status: QuestionReviewStatus;
    updated_at: Date;
    submitted_at: Date | null;
    reviewed_at: Date | null;
    review_feedback: string | null;
    quelle: string | null;
    fragen_kategorien: { fragenkategorie_id: number }[];
    created_by_user_id: number | null;
  },
  creatorNames?: Map<number, string>,
): DashboardQuestionItem {
  return {
    id: question.fragen_id,
    text: question.frage,
    status: question.review_status,
    timestamp: timestampForStatus(question),
    reviewFeedback: question.review_feedback,
    missingSource: question.quelle === null || question.quelle === "",
    missingCategory: question.fragen_kategorien.length === 0,
    creatorName:
      question.created_by_user_id === null
        ? null
        : (creatorNames?.get(question.created_by_user_id) ?? null),
  };
}

export async function loadEditorDashboardData(
  userId: number,
): Promise<EditorDashboardData> {
  const baseWhere = {
    created_by_user_id: userId,
    ist_archiviert: false,
  } as const;
  const weekStart = startOfCurrentBerlinWeek();

  const [
    changesRequested,
    drafts,
    inReview,
    approved,
    createdThisWeek,
    approvedThisWeek,
    changeTasks,
    draftTasks,
    reviewTasks,
    lastEdited,
  ] = await Promise.all([
    prisma.fragen.count({
      where: { ...baseWhere, review_status: "CHANGES_REQUESTED" },
    }),
    prisma.fragen.count({
      where: { ...baseWhere, review_status: "DRAFT" },
    }),
    prisma.fragen.count({
      where: { ...baseWhere, review_status: "IN_REVIEW" },
    }),
    prisma.fragen.count({
      where: { ...baseWhere, review_status: "APPROVED" },
    }),
    prisma.fragen.count({
      where: { ...baseWhere, created_at: { gte: weekStart } },
    }),
    prisma.fragen.count({
      where: {
        ...baseWhere,
        review_status: "APPROVED",
        approved_at: { gte: weekStart },
      },
    }),
    prisma.fragen.findMany({
      where: { ...baseWhere, review_status: "CHANGES_REQUESTED" },
      orderBy: [{ reviewed_at: "desc" }, { updated_at: "desc" }],
      take: DASHBOARD_LIST_LIMIT,
      select: questionSelect,
    }),
    prisma.fragen.findMany({
      where: { ...baseWhere, review_status: "DRAFT" },
      orderBy: { updated_at: "desc" },
      take: DASHBOARD_LIST_LIMIT,
      select: questionSelect,
    }),
    prisma.fragen.findMany({
      where: { ...baseWhere, review_status: "IN_REVIEW" },
      orderBy: [{ submitted_at: "desc" }, { updated_at: "desc" }],
      take: DASHBOARD_LIST_LIMIT,
      select: questionSelect,
    }),
    prisma.fragen.findFirst({
      where: {
        ...baseWhere,
        review_status: {
          in: ["DRAFT", "CHANGES_REQUESTED", "IN_REVIEW"],
        },
      },
      orderBy: { updated_at: "desc" },
      select: questionSelect,
    }),
  ]);

  return {
    counts: {
      changesRequested,
      drafts,
      inReview,
      approved,
      createdThisWeek,
      approvedThisWeek,
    },
    tasks: [...changeTasks, ...draftTasks, ...reviewTasks]
      .slice(0, DASHBOARD_LIST_LIMIT)
      .map((question) => toQuestionItem(question)),
    lastEdited: lastEdited ? toQuestionItem(lastEdited) : null,
  };
}

export async function loadAdminQuestionDashboardData(): Promise<AdminQuestionDashboardData> {
  const activeWhere = { ist_archiviert: false } as const;
  const reviewWhere = {
    ...activeWhere,
    review_status: "IN_REVIEW" as const,
  };
  const weekStart = startOfCurrentBerlinWeek();
  const today = toDatabaseDate(getBerlinDateParts());

  const [
    awaitingReview,
    approved,
    drafts,
    changesRequested,
    outdated,
    missingSource,
    missingCategory,
    approvedMissingSource,
    createdThisWeek,
    approvedThisWeek,
    reviewQuestions,
  ] = await Promise.all([
    prisma.fragen.count({ where: reviewWhere }),
    prisma.fragen.count({
      where: { ...activeWhere, review_status: "APPROVED" },
    }),
    prisma.fragen.count({
      where: { ...activeWhere, review_status: "DRAFT" },
    }),
    prisma.fragen.count({
      where: { ...activeWhere, review_status: "CHANGES_REQUESTED" },
    }),
    prisma.fragen.count({
      where: {
        ...activeWhere,
        review_status: "APPROVED",
        gueltig_bis: { lt: today },
      },
    }),
    prisma.fragen.count({
      where: { ...activeWhere, OR: [{ quelle: null }, { quelle: "" }] },
    }),
    prisma.fragen.count({
      where: { ...activeWhere, fragen_kategorien: { none: {} } },
    }),
    prisma.fragen.count({
      where: {
        ...activeWhere,
        review_status: "APPROVED",
        OR: [{ quelle: null }, { quelle: "" }],
      },
    }),
    prisma.fragen.count({
      where: { ...activeWhere, created_at: { gte: weekStart } },
    }),
    prisma.fragen.count({
      where: {
        ...activeWhere,
        review_status: "APPROVED",
        approved_at: { gte: weekStart },
      },
    }),
    prisma.fragen.findMany({
      where: reviewWhere,
      orderBy: [{ submitted_at: "asc" }, { updated_at: "asc" }],
      take: DASHBOARD_LIST_LIMIT,
      select: questionSelect,
    }),
  ]);

  const creatorIds = [
    ...new Set(
      reviewQuestions
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

  return {
    counts: {
      awaitingReview,
      approved,
      drafts,
      changesRequested,
      outdated,
      missingSource,
      missingCategory,
      approvedWithSource: approved - approvedMissingSource,
      createdThisWeek,
      approvedThisWeek,
    },
    reviewQueue: reviewQuestions.map((question) =>
      toQuestionItem(question, creatorNames),
    ),
  };
}

export async function loadAdminQuizDashboardData(): Promise<AdminQuizDashboardData> {
  const today = toDatabaseDate(getBerlinDateParts());
  const quizzes = await prisma.quiz.findMany({
    where: {
      ist_archiviert: false,
      quiz_datum: { gte: today },
    },
    orderBy: [{ quiz_datum: "asc" }, { quiz_id: "asc" }],
    take: UPCOMING_QUIZ_LIMIT,
    select: {
      quiz_id: true,
      titel: true,
      quiz_datum: true,
      _count: {
        select: {
          quiz_fragen: true,
          quiz_teams: true,
        },
      },
    },
  });

  return {
    upcomingQuizzes: quizzes.flatMap((quiz) => {
      if (!quiz.quiz_datum) return [];

      return [{
        id: quiz.quiz_id,
        title: quiz.titel?.trim() || `Quiz ${quiz.quiz_id}`,
        date: quiz.quiz_datum,
        daysUntil: Math.round(
          (quiz.quiz_datum.getTime() - today.getTime()) / 86_400_000,
        ),
        questionCount: quiz._count.quiz_fragen,
        teamCount: quiz._count.quiz_teams,
      }];
    }),
  };
}

export async function loadAdminUserDashboardData(): Promise<AdminUserDashboardData> {
  const [activeUsers, editors, admins, passwordChangeRequired, inactiveUsers] =
    await Promise.all([
      prisma.users.count({ where: { is_active: true } }),
      prisma.users.count({ where: { is_active: true, role: "EDITOR" } }),
      prisma.users.count({ where: { is_active: true, role: "ADMIN" } }),
      prisma.users.count({
        where: { is_active: true, must_change_password: true },
      }),
      prisma.users.count({ where: { is_active: false } }),
    ]);

  return {
    activeUsers,
    editors,
    admins,
    passwordChangeRequired,
    inactiveUsers,
  };
}
