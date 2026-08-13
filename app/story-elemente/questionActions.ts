"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireQuestionAccess } from "@/app/fragen/editor/questionAccess.server";
import { loadStoryElement } from "./storyElementRepository.server";
import {
  canViewStoryElement,
} from "./storyElementPolicy";
import {
  getNewStoryQuestionRelationship,
  isStoryQuestionRelationship,
  PRODUCTIVE_STORY_QUESTION_RELATIONSHIPS,
  type StoryQuestionRelationshipValue,
} from "./storyElement";
import {
  isStoryPlacement,
  storyPlacementToRelationship,
  type StoryPlacement,
} from "./storyPlacement";

type LinkResult = { success: true } | { success: false; message: string };

function revalidateQuestionStoryLinks(questionId: number) {
  revalidatePath(`/fragen/editor/${questionId}`);
  revalidatePath(`/content/questions/${questionId}`);
  revalidatePath("/story-elemente");
}

function storyMatchesQuestion(
  story: NonNullable<Awaited<ReturnType<typeof loadStoryElement>>>,
  actor: Awaited<ReturnType<typeof requireQuestionAccess>>["actor"],
  context: Awaited<ReturnType<typeof requireQuestionAccess>>["context"],
) {
  return canViewStoryElement(actor, story.access) &&
    story.scope !== "QUIZ" &&
    (story.scope === "GLOBAL" ||
      (story.scope === "EVENT_SERIES" &&
        story.eventSeriesId !== null &&
        context.scope === "EVENT_SERIES" &&
        context.eventSeriesIds.includes(story.eventSeriesId)));
}

export async function linkQuestionStoryElement(input: {
  questionId: number;
  storyElementId: number;
  relationship?: StoryQuestionRelationshipValue;
}): Promise<LinkResult> {
  if (
    input.relationship !== undefined &&
    (!isStoryQuestionRelationship(input.relationship) ||
      !PRODUCTIVE_STORY_QUESTION_RELATIONSHIPS.some(
        (relationship) => relationship === input.relationship,
      ))
  ) {
    return { success: false, message: "Die Beziehungsart ist ungültig." };
  }
  const { actor, context } = await requireQuestionAccess(input.questionId, "EDIT");
  const story = await loadStoryElement(actor, input.storyElementId);
  if (!story || !storyMatchesQuestion(story, actor, context)) {
    return { success: false, message: "Story-Element ist für diese Frage nicht auswählbar." };
  }
  const linked = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${input.storyElementId})`;
    const existingStoryLink = await tx.frage_story_elemente.findFirst({
      where: { story_element_id: input.storyElementId },
      select: { fragen_id: true },
    });
    if (existingStoryLink && existingStoryLink.fragen_id !== input.questionId) return false;
    const last = await tx.frage_story_elemente.findFirst({
      where: { fragen_id: input.questionId },
      orderBy: [{ sortierung: "desc" }, { frage_story_element_id: "desc" }],
      select: { sortierung: true },
    });
    const relationship = input.relationship ?? getNewStoryQuestionRelationship();
    await tx.frage_story_elemente.upsert({
      where: { fragen_id_story_element_id: {
        fragen_id: input.questionId,
        story_element_id: input.storyElementId,
      } },
      create: {
        fragen_id: input.questionId,
        story_element_id: input.storyElementId,
        beziehung: relationship,
        sortierung: (last?.sortierung ?? 0) + 10,
        created_by_user_id: actor.userId,
      },
      update: {
        beziehung: relationship,
        created_by_user_id: actor.userId,
      },
    });
    return true;
  });
  if (!linked) return { success: false, message: "Dieses Story-Element ist bereits mit einer anderen Frage verknüpft." };
  revalidateQuestionStoryLinks(input.questionId);
  return { success: true };
}

export async function updateQuestionStoryElementPlacement(input: {
  questionId: number;
  storyElementId: number;
  placement: StoryPlacement;
}): Promise<LinkResult> {
  if (!isStoryPlacement(input.placement)) {
    return { success: false, message: "Die Standardposition ist ungültig." };
  }
  await requireQuestionAccess(input.questionId, "EDIT");
  const updated = await prisma.frage_story_elemente.updateMany({
    where: {
      fragen_id: input.questionId,
      story_element_id: input.storyElementId,
    },
    data: {
      beziehung: storyPlacementToRelationship(input.placement),
    },
  });
  if (updated.count !== 1) {
    return { success: false, message: "Die Story-Verknüpfung wurde nicht gefunden." };
  }
  revalidateQuestionStoryLinks(input.questionId);
  return { success: true };
}

export async function unlinkQuestionStoryElement(input: {
  questionId: number;
  storyElementId: number;
}): Promise<LinkResult> {
  const { actor, context } = await requireQuestionAccess(input.questionId, "EDIT");
  const story = await loadStoryElement(actor, input.storyElementId);
  if (!story || !storyMatchesQuestion(story, actor, context)) {
    return { success: false, message: "Die Verknüpfung darf nicht entfernt werden." };
  }
  await prisma.frage_story_elemente.deleteMany({
    where: {
      fragen_id: input.questionId,
      story_element_id: input.storyElementId,
    },
  });
  revalidateQuestionStoryLinks(input.questionId);
  return { success: true };
}

export async function reorderQuestionStoryElements(input: {
  questionId: number;
  storyElementIds: number[];
}): Promise<LinkResult> {
  const { actor, context } = await requireQuestionAccess(input.questionId, "EDIT");
  if (
    !Array.isArray(input.storyElementIds) ||
    new Set(input.storyElementIds).size !== input.storyElementIds.length ||
    input.storyElementIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
  ) {
    return { success: false, message: "Die Reihenfolge ist ungültig." };
  }
  const existing = await prisma.frage_story_elemente.findMany({
    where: { fragen_id: input.questionId },
    select: { story_element_id: true },
  });
  if (
    existing.length !== input.storyElementIds.length ||
    existing.some((link) => !input.storyElementIds.includes(link.story_element_id))
  ) {
    return { success: false, message: "Die Verknüpfungen haben sich zwischenzeitlich geändert." };
  }
  const stories = await Promise.all(input.storyElementIds.map((id) => loadStoryElement(actor, id)));
  if (stories.some((story) => !story || !storyMatchesQuestion(story, actor, context))) {
    return { success: false, message: "Mindestens ein Story-Element darf nicht sortiert werden." };
  }
  await prisma.$transaction(
    input.storyElementIds.map((storyElementId, index) =>
      prisma.frage_story_elemente.update({
        where: { fragen_id_story_element_id: { fragen_id: input.questionId, story_element_id: storyElementId } },
        data: { sortierung: (index + 1) * 10 },
      }),
    ),
  );
  revalidateQuestionStoryLinks(input.questionId);
  return { success: true };
}
