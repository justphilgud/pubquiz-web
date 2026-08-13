"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireActor } from "@/app/lib/permissions";
import { requireQuizEditor } from "@/app/quiz/quizAccess.server";
import { getActorForSession } from "@/app/roles/roleAssignments.server";
import {
  canArchiveStoryElement,
  canCreateStoryElement,
  canEditStoryElement,
  canAttachStoryElementToQuiz,
} from "./storyElementPolicy";
import {
  loadStoryElement,
  resolveStoryElementScopeSelection,
} from "./storyElementRepository.server";
import {
  validateStoryElementInput,
  type StoryElementMutationInput,
} from "./storyElement";

export type StoryElementActionResult =
  | { success: true; storyElementId: number; updatedAt: string; message: string }
  | { success: false; message: string; conflict?: boolean };

function revalidateStoryElement(storyElementId?: number) {
  revalidatePath("/story-elemente");
  if (storyElementId) {
    revalidatePath(`/story-elemente/${storyElementId}`);
    revalidatePath(`/content/story-elements/${storyElementId}`);
  }
  revalidatePath("/fragen", "layout");
  revalidatePath("/quiz/[quizId]", "page");
}

export async function createStoryElement(
  input: StoryElementMutationInput,
): Promise<StoryElementActionResult> {
  const { actor } = await requireActor();
  if (!canCreateStoryElement(actor)) {
    return { success: false, message: "Story-Elemente dürfen mit dieser Rolle nicht erstellt werden." };
  }
  const validated = validateStoryElementInput(input);
  if (!validated.ok) return { success: false, message: validated.message };
  await resolveStoryElementScopeSelection(actor, validated.value);

  const created = await prisma.story_elemente.create({
    data: {
      stable_key: `story-${randomUUID()}`,
      status: validated.value.status,
      geltungsbereich: validated.value.scope,
      eventreihe_id: validated.value.eventSeriesId,
      quiz_id: validated.value.quizId,
      created_by_user_id: actor.userId,
      revisionen: {
        create: {
          revisionsnummer: 1,
          typ: validated.value.type,
          titel: validated.value.title,
          beschreibung: validated.value.description,
          kategorie: validated.value.category,
          tags: validated.value.tags,
          moderationsnotiz: validated.value.moderatorNote,
          konfigurations_version: 1,
          konfiguration: validated.value.config as Prisma.InputJsonValue,
          created_by_user_id: actor.userId,
        },
      },
    },
    select: { story_element_id: true, updated_at: true },
  });
  revalidateStoryElement(created.story_element_id);
  return {
    success: true,
    storyElementId: created.story_element_id,
    updatedAt: created.updated_at.toISOString(),
    message: validated.value.status === "ACTIVE"
      ? "Story-Element wurde aktiviert."
      : "Story-Element wurde als Entwurf gespeichert.",
  };
}

export async function updateStoryElement(input: {
  storyElementId: number;
  expectedUpdatedAt: string;
  value: StoryElementMutationInput;
}): Promise<StoryElementActionResult> {
  const { actor } = await requireActor();
  const story = await loadStoryElement(actor, input.storyElementId);
  if (!story || !canEditStoryElement(actor, story.access)) {
    return { success: false, message: "Story-Element nicht gefunden oder nicht bearbeitbar." };
  }
  const validated = validateStoryElementInput(input.value);
  if (!validated.ok) return { success: false, message: validated.message };
  await resolveStoryElementScopeSelection(actor, validated.value);
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    return { success: false, message: "Der Bearbeitungsstand ist ungültig." };
  }
  if (
    story.usageCount > 0 &&
    (story.scope !== validated.value.scope ||
      story.eventSeriesId !== validated.value.eventSeriesId ||
      story.quizId !== validated.value.quizId)
  ) {
    return {
      success: false,
      message: "Der Geltungsbereich eines bereits verwendeten Story-Elements bleibt stabil. Bitte duplizieren Sie den Inhalt für einen anderen Bereich.",
    };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.story_elemente.updateMany({
        where: {
          story_element_id: input.storyElementId,
          updated_at: expectedUpdatedAt,
          status: { not: "ARCHIVED" },
        },
        data: {
          status: validated.value.status,
          geltungsbereich: validated.value.scope,
          eventreihe_id: validated.value.eventSeriesId,
          quiz_id: validated.value.quizId,
        },
      });
      if (claimed.count !== 1) {
        throw new StoryElementConflictError();
      }
      const latest = await tx.story_element_revisionen.aggregate({
        where: { story_element_id: input.storyElementId },
        _max: { revisionsnummer: true },
      });
      await tx.story_element_revisionen.create({
        data: {
          story_element_id: input.storyElementId,
          revisionsnummer: (latest._max.revisionsnummer ?? 0) + 1,
          typ: validated.value.type,
          titel: validated.value.title,
          beschreibung: validated.value.description,
          kategorie: validated.value.category,
          tags: validated.value.tags,
          moderationsnotiz: validated.value.moderatorNote,
          konfigurations_version: 1,
          konfiguration: validated.value.config as Prisma.InputJsonValue,
          created_by_user_id: actor.userId,
        },
      });
      return tx.story_elemente.findUniqueOrThrow({
        where: { story_element_id: input.storyElementId },
        select: { updated_at: true },
      });
    });
    revalidateStoryElement(input.storyElementId);
    return {
      success: true,
      storyElementId: input.storyElementId,
      updatedAt: updated.updated_at.toISOString(),
      message: "Neue Story-Element-Revision wurde gespeichert.",
    };
  } catch (error) {
    if (error instanceof StoryElementConflictError) {
      return {
        success: false,
        conflict: true,
        message: "Dieses Story-Element wurde zwischenzeitlich geändert. Bitte laden Sie die Seite neu und prüfen Sie den aktuellen Stand.",
      };
    }
    throw error;
  }
}

class StoryElementConflictError extends Error {}

export async function duplicateStoryElement(
  storyElementId: number,
): Promise<StoryElementActionResult> {
  const { actor } = await requireActor();
  const source = await loadStoryElement(actor, storyElementId);
  if (!source || !canCreateStoryElement(actor)) {
    return { success: false, message: "Story-Element kann nicht dupliziert werden." };
  }
  await resolveStoryElementScopeSelection(actor, {
    scope: source.scope,
    eventSeriesId: source.eventSeriesId,
    quizId: source.quizId,
  });
  const created = await prisma.story_elemente.create({
    data: {
      stable_key: `story-${randomUUID()}`,
      status: "DRAFT",
      geltungsbereich: source.scope,
      eventreihe_id: source.eventSeriesId,
      quiz_id: source.quizId,
      created_by_user_id: actor.userId,
      source_story_element_id: source.id,
      revisionen: {
        create: {
          revisionsnummer: 1,
          typ: source.type,
          titel: `${source.title} – Kopie`.slice(0, 160),
          beschreibung: source.description,
          kategorie: source.category,
          tags: source.tags,
          moderationsnotiz: source.moderatorNote,
          konfigurations_version: source.configVersion,
          konfiguration: source.config as Prisma.InputJsonValue,
          created_by_user_id: actor.userId,
        },
      },
    },
    select: { story_element_id: true, updated_at: true },
  });
  revalidateStoryElement(created.story_element_id);
  return {
    success: true,
    storyElementId: created.story_element_id,
    updatedAt: created.updated_at.toISOString(),
    message: "Unabhängiger Entwurf wurde angelegt.",
  };
}

export async function setStoryElementArchived(
  storyElementId: number,
  archived: boolean,
): Promise<StoryElementActionResult> {
  const { actor } = await requireActor();
  const story = await loadStoryElement(actor, storyElementId);
  if (!story || !canArchiveStoryElement(actor, story.access)) {
    return { success: false, message: "Story-Element darf nicht archiviert werden." };
  }
  const updated = await prisma.story_elemente.update({
    where: { story_element_id: storyElementId },
    data: {
      status: archived ? "ARCHIVED" : "DRAFT",
      archived_at: archived ? new Date() : null,
    },
    select: { updated_at: true },
  });
  revalidateStoryElement(storyElementId);
  return {
    success: true,
    storyElementId,
    updatedAt: updated.updated_at.toISOString(),
    message: archived
      ? "Story-Element wurde archiviert; bestehende Quizverwendungen bleiben stabil."
      : "Story-Element wurde als Entwurf reaktiviert.",
  };
}

export async function deleteUnusedStoryElement(
  storyElementId: number,
): Promise<StoryElementActionResult> {
  const { actor } = await requireActor();
  const story = await loadStoryElement(actor, storyElementId);
  if (!story || !canArchiveStoryElement(actor, story.access)) {
    return { success: false, message: "Story-Element darf nicht gelöscht werden." };
  }
  if (story.status !== "DRAFT" || story.usageCount > 0 || story.questionLinkCount > 0) {
    return {
      success: false,
      message: "Nur ungenutzte Entwürfe ohne Fragenverknüpfung können endgültig gelöscht werden.",
    };
  }
  await prisma.story_elemente.delete({
    where: { story_element_id: storyElementId },
  });
  revalidateStoryElement();
  return {
    success: true,
    storyElementId,
    updatedAt: new Date().toISOString(),
    message: "Ungenutzter Entwurf wurde gelöscht.",
  };
}

export async function addStoryElementToQuiz(input: {
  quizId: number;
  storyElementId: number;
}): Promise<{ success: boolean; message: string }> {
  const access = await requireQuizEditor(input.quizId);
  const actor = await getActorForSession(access.session);
  const story = await loadStoryElement(actor, input.storyElementId);
  const eventSeriesId = access.ownership.eventSeriesId;
  if (!story || eventSeriesId === null || !canAttachStoryElementToQuiz(actor, story.access, {
    quizId: input.quizId,
    eventSeriesId,
  })) {
    return { success: false, message: "Story-Element ist für dieses Quiz nicht auswählbar." };
  }
  const linkedQuestion = await prisma.frage_story_elemente.findFirst({
    where: { story_element_id: story.id },
    select: { frage: { select: { frage: true } } },
  });
  if (linkedQuestion) {
    return {
      success: false,
      message: `Gehört zur Frage „${linkedQuestion.frage.frage}“ und darf nicht frei als Standalone hinzugefügt werden.`,
    };
  }
  const added = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${story.id})`;
    const duplicate = await tx.quiz_ablauf_elemente.findFirst({
      where: {
        quiz_id: input.quizId,
        story_element_revision: { story_element_id: story.id },
      },
      select: { quiz_ablauf_element_id: true },
    });
    if (duplicate) return false;
    const last = await tx.quiz_ablauf_elemente.findFirst({
      where: { quiz_id: input.quizId, anker_typ: "BEFORE_QUIZ", anker_schluessel: "UNASSIGNED" },
      orderBy: [{ sortierung: "desc" }, { quiz_ablauf_element_id: "desc" }],
      select: { sortierung: true },
    });
    await tx.quiz_ablauf_elemente.create({
      data: {
        quiz_id: input.quizId,
        typ: story.type,
        anker_typ: "BEFORE_QUIZ",
        anker_schluessel: "UNASSIGNED",
        quiz_abschnitt_id: null,
        story_element_revision_id: story.revisionId,
        sortierung: (last?.sortierung ?? 0) + 1_000,
        ist_sichtbar: false,
        bezeichnung: story.title,
        konfiguration: { version: 1 },
        konfigurations_version: 1,
        ist_standard: false,
      },
    });
    return true;
  });
  if (!added) return { success: false, message: "Bereits in diesem Quiz vorhanden." };
  revalidateStoryElement(story.id);
  revalidatePath(`/quiz/${input.quizId}`);
  return { success: true, message: "Zum Quiz hinzugefügt. Die Blockzuordnung ist noch offen." };
}
