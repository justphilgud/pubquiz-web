import "server-only";

import { prisma } from "@/app/lib/prisma";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import {
  isStoryElementType,
  type StoryQuestionRelationshipValue,
} from "./storyElement";
import { listStoryElements } from "./storyElementRepository.server";

export async function loadQuestionStoryElementPanel(
  actor: AuthorizationActor,
  questionId: number,
) {
  const [question, links, activeStories, ownDrafts] = await Promise.all([
    prisma.fragen.findUnique({
      where: { fragen_id: questionId },
      select: {
        geltungsbereich: true,
        eventreihen: { select: { eventreihe_id: true } },
      },
    }),
    prisma.frage_story_elemente.findMany({
      where: { fragen_id: questionId },
      include: {
        story_element: {
          include: {
            eventreihe: { select: { name: true } },
            quiz: { select: { eventreihe: { select: { name: true } } } },
            revisionen: {
              orderBy: { revisionsnummer: "desc" },
              take: 1,
              select: { typ: true, titel: true, beschreibung: true },
            },
          },
        },
      },
      orderBy: [{ sortierung: "asc" }, { frage_story_element_id: "asc" }],
    }),
    listStoryElements(actor, { status: "ACTIVE" }),
    listStoryElements(actor, { status: "DRAFT", creator: "ME" }),
  ]);
  if (!question) return { links: [], options: [] };
  const eventSeriesIds = new Set(
    question.eventreihen.map((entry) => entry.eventreihe_id),
  );
  const selectable = [...activeStories, ...ownDrafts].filter((story, index, all) =>
    all.findIndex((candidate) => candidate.id === story.id) === index &&
    story.scope !== "QUIZ" &&
    (story.scope === "GLOBAL" ||
      (question.geltungsbereich === "EVENT_SERIES" &&
        story.eventSeriesId !== null &&
        eventSeriesIds.has(story.eventSeriesId))),
  );
  const linkedIds = new Set(links.map((link) => link.story_element_id));
  return {
    links: links.flatMap((link) => {
      const revision = link.story_element.revisionen[0];
      return revision && isStoryElementType(revision.typ)
        ? [{
            id: link.story_element_id,
            title: revision.titel,
            description: revision.beschreibung,
            type: revision.typ,
            status: link.story_element.status,
            eventSeriesName:
              link.story_element.eventreihe?.name ??
              link.story_element.quiz?.eventreihe.name ??
              null,
            relationship: link.beziehung as StoryQuestionRelationshipValue,
          }]
        : [];
    }),
    options: selectable.filter((story) => !linkedIds.has(story.id)).map((story) => ({
      id: story.id,
      title: story.title,
      type: story.type,
      status: story.status,
      description: story.description,
      scope: story.scope,
      eventSeriesName: story.eventSeriesName,
    })),
  };
}
