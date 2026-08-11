import "server-only";

import { prisma } from "@/app/lib/prisma";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { mapQuestionAccessContext } from "@/app/fragen/editor/questionAccess.server";
import { canEditScopedQuestion } from "@/app/fragen/editor/questionScopePolicy";
import type { StoryElementRecord } from "./storyElementRepository.server";
import type { StoryQuestionRelationshipValue } from "./storyElement";

const questionSelect = {
  fragen_id: true,
  frage: true,
  geltungsbereich: true,
  created_by_user_id: true,
  review_status: true,
  ist_archiviert: true,
  freigegeben: true,
  eventreihen: {
    select: {
      eventreihe_id: true,
      eventreihe: { select: { name: true } },
    },
  },
  quiz_fragen: {
    select: {
      quiz: {
        select: {
          quiz_id: true,
          titel: true,
          eventreihe: { select: { name: true } },
        },
      },
    },
  },
} as const;

function questionMatchesStory(
  question: { geltungsbereich: string; eventreihen: Array<{ eventreihe_id: number }> },
  story: StoryElementRecord,
) {
  if (story.scope === "QUIZ") return false;
  if (story.scope === "GLOBAL") return true;
  return question.geltungsbereich === "EVENT_SERIES" &&
    story.eventSeriesId !== null &&
    question.eventreihen.some((series) => series.eventreihe_id === story.eventSeriesId);
}

export async function loadStoryQuestionLinksPanel(
  actor: AuthorizationActor,
  story: StoryElementRecord,
) {
  const [links, candidates] = await Promise.all([
    prisma.frage_story_elemente.findMany({
      where: { story_element_id: story.id },
      include: { frage: { select: questionSelect } },
      orderBy: [{ created_at: "asc" }, { frage_story_element_id: "asc" }],
    }),
    prisma.fragen.findMany({
      where: { ist_archiviert: false },
      select: questionSelect,
      orderBy: { fragen_id: "desc" },
      take: 250,
    }),
  ]);
  const linkedIds = new Set(links.map((link) => link.fragen_id));
  const mapQuestion = (question: (typeof candidates)[number]) => ({
    questionId: question.fragen_id,
    title: question.frage,
    status: question.ist_archiviert
      ? "Archiviert"
      : question.freigegeben
        ? "Freigegeben"
        : question.review_status === "DRAFT"
          ? "Entwurf"
          : question.review_status,
    eventSeriesNames: question.eventreihen.map((series) => series.eventreihe.name),
    quizzes: question.quiz_fragen.map((usage) => ({
      id: usage.quiz.quiz_id,
      title: usage.quiz.titel ?? `Quiz ${usage.quiz.quiz_id}`,
      eventSeriesName: usage.quiz.eventreihe.name,
    })),
  });
  return {
    links: links.map((link) => ({
      ...mapQuestion(link.frage),
      relationship: link.beziehung as StoryQuestionRelationshipValue,
      canEdit: canEditScopedQuestion(actor, mapQuestionAccessContext(link.frage)),
    })),
    options: (links.length > 0 ? [] : candidates)
      .filter((question) =>
        !linkedIds.has(question.fragen_id) &&
        canEditScopedQuestion(actor, mapQuestionAccessContext(question)) &&
        questionMatchesStory(question, story),
      )
      .map(mapQuestion),
  };
}
