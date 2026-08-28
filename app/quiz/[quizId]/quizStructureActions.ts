"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  requireQuizEditor,
  requireQuizQuestionSection,
} from "@/app/quiz/quizAccess.server";
import {
  getInitialQuizFlowConfig,
  getEffectiveQuizSolutionStrategy,
  isQuizGlobalFlowItemType,
  isQuizSolutionStrategy,
  QUIZ_FLOW_ANCHOR_TYPES,
  QUIZ_FLOW_ITEM_TYPES,
  validateQuizFlowConfig,
  type QuizFlowAnchorType,
  type QuizFlowConfig,
  type QuizFlowItemType,
  type QuizSolutionStrategy,
} from "@/app/quiz/flow/quizFlow";
import {
  materializeManualQuizBlockSequence,
  materializeQuizBlockQuestionItems,
  materializeQuizQuestionStoryItems,
  materializeDefaultQuizFlow,
  resolveEditableQuizFlowItem,
} from "@/app/quiz/flow/quizFlowRepository.server";
import { getActorForSession } from "@/app/roles/roleAssignments.server";
import { loadStoryElement } from "@/app/story-elemente/storyElementRepository.server";
import { canAttachStoryElementToQuiz } from "@/app/story-elemente/storyElementPolicy";
import {
  isStoryPlacement,
  storyPlacementConfig,
  storyPlacementToRelationship,
  type StoryPlacementOverride,
} from "@/app/story-elemente/storyPlacement";

type FlowActionResult = { success: true } | { success: false; message: string };

function revalidateQuizFlow(quizId: number) {
  revalidatePath(`/quiz/${quizId}`);
  revalidatePath(`/quiz/${quizId}/moderation`);
  revalidatePath(`/quiz/${quizId}/praesentation`);
  revalidatePath(`/quiz/${quizId}/antworten`);
  revalidatePath(`/quiz/${quizId}/test`);
}

function isFlowItemType(value: string): value is QuizFlowItemType {
  return QUIZ_FLOW_ITEM_TYPES.some((itemType) => itemType === value);
}

function isFlowAnchorType(value: string): value is QuizFlowAnchorType {
  return QUIZ_FLOW_ANCHOR_TYPES.some((anchorType) => anchorType === value);
}

async function validateAnchor(
  quizId: number,
  anchorType: QuizFlowAnchorType,
  sectionId: number | null,
) {
  const isSectionAnchor =
    anchorType === "ROUND_START" ||
    anchorType === "ROUND_END" ||
    anchorType === "BLOCK";
  if (isSectionAnchor && sectionId === null) {
    throw new Error("Ein Rundenanker benötigt einen Quizblock.");
  }
  if (!isSectionAnchor && sectionId !== null) {
    throw new Error("Dieser Anker darf keinen Quizblock referenzieren.");
  }
  if (sectionId !== null) await requireQuizQuestionSection(quizId, sectionId);
}

export async function updateQuizFlowItem(data: {
  quizId: number;
  itemId: string;
  label: string | null;
  config: QuizFlowConfig;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  const item = await resolveEditableQuizFlowItem(data.quizId, data.itemId);
  if (!item?.persistentId) {
    return { success: false, message: "Ablaufelement wurde nicht gefunden." };
  }
  if (item.type === "QUESTION" || item.type === "QUESTION_SOLUTION") {
    return { success: false, message: "Frageninhalte werden in der Quizpflege bearbeitet." };
  }
  if (item.storyElementRevisionId) {
    return {
      success: false,
      message: "Bibliotheksinhalte werden als neue Story-Element-Revision bearbeitet.",
    };
  }
  const validated = validateQuizFlowConfig(item.type, data.config);
  if (!validated.ok) return { success: false, message: validated.message };
  const label = data.label?.trim() || null;
  if (label && label.length > 160) {
    return { success: false, message: "Die Bezeichnung ist zu lang." };
  }
  await prisma.quiz_ablauf_elemente.update({
    where: { quiz_ablauf_element_id: item.persistentId },
    data: {
      bezeichnung: label,
      konfiguration: validated.value as Prisma.InputJsonValue,
    },
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function toggleQuizFlowItem(data: {
  quizId: number;
  itemId: string;
  enabled: boolean;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  const item = await resolveEditableQuizFlowItem(data.quizId, data.itemId);
  if (!item?.persistentId) {
    return { success: false, message: "Ablaufelement wurde nicht gefunden." };
  }
  if (item.type === "QUESTION" || item.type === "QUESTION_SOLUTION") {
    return { success: false, message: "Fragen und Auflösungen bleiben im Ablauf aktiv." };
  }
  await prisma.quiz_ablauf_elemente.update({
    where: { quiz_ablauf_element_id: item.persistentId },
    data: { ist_sichtbar: data.enabled },
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function addQuizFlowItem(data: {
  quizId: number;
  type: string;
  anchorType: string;
  sectionId: number | null;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  if (!isFlowItemType(data.type) || !isFlowAnchorType(data.anchorType)) {
    return { success: false, message: "Typ oder Position ist ungültig." };
  }
  if (data.anchorType === "BLOCK") {
    return {
      success: false,
      message: "Story-Elemente werden im Block ausschließlich aus der Bibliothek hinzugefügt.",
    };
  }
  if (!isQuizGlobalFlowItemType(data.type)) {
    return { success: false, message: "Dieser Elementtyp ist an dieser Position nicht erlaubt." };
  }
  await validateAnchor(data.quizId, data.anchorType, data.sectionId);
  await materializeDefaultQuizFlow(data.quizId);
  const anchorKey = data.sectionId === null ? "QUIZ" : String(data.sectionId);
  const last = await prisma.quiz_ablauf_elemente.findFirst({
    where: {
      quiz_id: data.quizId,
      anker_typ: data.anchorType,
      anker_schluessel: anchorKey,
    },
    orderBy: { sortierung: "desc" },
    select: { sortierung: true },
  });
  await prisma.quiz_ablauf_elemente.create({
    data: {
      quiz_id: data.quizId,
      typ: data.type,
      anker_typ: data.anchorType,
      anker_schluessel: anchorKey,
      quiz_abschnitt_id: data.sectionId,
      sortierung: (last?.sortierung ?? 0) + 10,
      ist_sichtbar: true,
      konfiguration: getInitialQuizFlowConfig(data.type) as Prisma.InputJsonValue,
      konfigurations_version: 1,
      ist_standard: false,
    },
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function addStoryElementToQuizBlock(data: {
  quizId: number;
  sectionId: number;
  storyElementId: number;
}): Promise<FlowActionResult> {
  const access = await requireQuizEditor(data.quizId);
  await requireQuizQuestionSection(data.quizId, data.sectionId);
  const actor = await getActorForSession(access.session);
  const story = await loadStoryElement(actor, data.storyElementId);
  const eventSeriesId = access.ownership.eventSeriesId;
  if (
    !story ||
    eventSeriesId === null ||
    !canAttachStoryElementToQuiz(actor, story.access, {
      quizId: data.quizId,
      eventSeriesId,
    })
  ) {
    return { success: false, message: "Story-Element ist für dieses Quiz nicht auswählbar." };
  }
  const questionLink = await prisma.frage_story_elemente.findFirst({
    where: { story_element_id: story.id },
    select: {
      fragen_id: true,
      frage: { select: { frage: true } },
    },
  });
  if (questionLink) {
    const assignment = await prisma.quiz_fragen.findFirst({
      where: { quiz_id: data.quizId, fragen_id: questionLink.fragen_id },
      select: { quiz_fragen_id: true, quiz_abschnitt_id: true },
    });
    if (!assignment) {
      return {
        success: false,
        message: `Gehört zur Frage „${questionLink.frage.frage}“. Diese Frage ist noch nicht im Quiz.`,
      };
    }
    if (assignment.quiz_abschnitt_id === null) {
      return {
        success: false,
        message: `Gehört zur Frage „${questionLink.frage.frage}“. Weise die Frage zuerst einem Block zu.`,
      };
    }
    await materializeQuizBlockQuestionItems(
      data.quizId,
      assignment.quiz_abschnitt_id,
    );
    const placementConflict = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${story.id})`;
      const existingPlacement = await tx.quiz_ablauf_elemente.findFirst({
        where: {
          quiz_id: data.quizId,
          story_element_revision: { story_element_id: story.id },
        },
        select: {
          quiz_ablauf_element_id: true,
          story_bezugs_quiz_fragen_id: true,
        },
      });
      if (
        existingPlacement &&
        existingPlacement.story_bezugs_quiz_fragen_id !== assignment.quiz_fragen_id
      ) {
        return true;
      }
      if (existingPlacement) return false;
      const last = await tx.quiz_ablauf_elemente.findFirst({
        where: {
          quiz_id: data.quizId,
          quiz_abschnitt_id: assignment.quiz_abschnitt_id,
          anker_typ: "BLOCK",
        },
        orderBy: [{ sortierung: "desc" }, { quiz_ablauf_element_id: "desc" }],
        select: { sortierung: true },
      });
      await tx.quiz_ablauf_elemente.create({
        data: {
          quiz_id: data.quizId,
          typ: story.type,
          anker_typ: "BLOCK",
          anker_schluessel: String(assignment.quiz_abschnitt_id),
          quiz_abschnitt_id: assignment.quiz_abschnitt_id,
          story_element_revision_id: story.revisionId,
          story_bezugs_quiz_fragen_id: assignment.quiz_fragen_id,
          story_beziehung: null,
          sortierung: (last?.sortierung ?? 0) + 1_000,
          ist_sichtbar: true,
          bezeichnung: story.title,
          konfiguration: { version: 1 },
          konfigurations_version: 1,
          ist_standard: false,
        },
      });
      return false;
    });
    if (placementConflict) {
      return {
        success: false,
        message: "Dieses Story-Element besitzt ein historisches freies Placement. Es wurde nicht automatisch verändert.",
      };
    }
    revalidateQuizFlow(data.quizId);
    return { success: true };
  }

  await materializeQuizBlockQuestionItems(data.quizId, data.sectionId);
  const added = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${story.id})`;
    const duplicate = await tx.quiz_ablauf_elemente.findFirst({
      where: {
        quiz_id: data.quizId,
        story_element_revision: { story_element_id: story.id },
      },
      select: { quiz_ablauf_element_id: true },
    });
    if (duplicate) return false;
    const last = await tx.quiz_ablauf_elemente.findFirst({
      where: {
        quiz_id: data.quizId,
        quiz_abschnitt_id: data.sectionId,
        anker_typ: "BLOCK",
      },
      orderBy: [{ sortierung: "desc" }, { quiz_ablauf_element_id: "desc" }],
      select: { sortierung: true },
    });
    await tx.quiz_ablauf_elemente.create({
      data: {
        quiz_id: data.quizId,
        typ: story.type,
        anker_typ: "BLOCK",
        anker_schluessel: String(data.sectionId),
        quiz_abschnitt_id: data.sectionId,
        story_element_revision_id: story.revisionId,
        sortierung: (last?.sortierung ?? 0) + 1_000,
        ist_sichtbar: true,
        bezeichnung: story.title,
        konfiguration: { version: 1 },
        konfigurations_version: 1,
        ist_standard: false,
      },
    });
    return true;
  });
  if (!added) {
    return { success: false, message: "Dieses Story-Element ist bereits im Quiz vorhanden." };
  }
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function assignUnassignedStoryElementToBlock(data: {
  quizId: number;
  sectionId: number;
  placementId: number;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  await requireQuizQuestionSection(data.quizId, data.sectionId);
  const placement = await prisma.quiz_ablauf_elemente.findFirst({
    where: {
      quiz_ablauf_element_id: data.placementId,
      quiz_id: data.quizId,
      anker_typ: "BEFORE_QUIZ",
      anker_schluessel: "UNASSIGNED",
      quiz_abschnitt_id: null,
      story_element_revision_id: { not: null },
    },
    select: {
      quiz_ablauf_element_id: true,
      story_element_revision: { select: { story_element_id: true } },
    },
  });
  if (!placement) return { success: false, message: "Die offene Story-Zuordnung wurde nicht gefunden." };
  const linkedQuestion = await prisma.frage_story_elemente.findFirst({
    where: {
      story_element_id: placement.story_element_revision!.story_element_id,
    },
    select: { fragen_id: true },
  });
  if (linkedQuestion) {
    return {
      success: false,
      message: "Ein mit einer Frage verknüpftes Story-Element darf nicht frei als Standalone platziert werden.",
    };
  }
  await materializeQuizBlockQuestionItems(data.quizId, data.sectionId);
  const last = await prisma.quiz_ablauf_elemente.findFirst({
    where: { quiz_id: data.quizId, quiz_abschnitt_id: data.sectionId, anker_typ: "BLOCK" },
    orderBy: [{ sortierung: "desc" }, { quiz_ablauf_element_id: "desc" }],
    select: { sortierung: true },
  });
  await prisma.quiz_ablauf_elemente.update({
    where: { quiz_ablauf_element_id: placement.quiz_ablauf_element_id },
    data: {
      anker_typ: "BLOCK",
      anker_schluessel: String(data.sectionId),
      quiz_abschnitt_id: data.sectionId,
      sortierung: (last?.sortierung ?? 0) + 1_000,
      ist_sichtbar: true,
    },
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function moveQuizFlowItem(data: {
  quizId: number;
  itemId: string;
  direction: -1 | 1;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  const item = await resolveEditableQuizFlowItem(data.quizId, data.itemId);
  if (!item?.persistentId) {
    return { success: false, message: "Ablaufelement wurde nicht gefunden." };
  }
  const siblings = await prisma.quiz_ablauf_elemente.findMany({
    where: {
      quiz_id: data.quizId,
      anker_typ: item.anchorType,
      anker_schluessel: item.anchorKey,
    },
    orderBy: [{ sortierung: "asc" }, { quiz_ablauf_element_id: "asc" }],
  });
  const currentIndex = siblings.findIndex(
    (entry) => entry.quiz_ablauf_element_id === item.persistentId,
  );
  const target = siblings[currentIndex + data.direction];
  if (!target) return { success: true };

  await prisma.$transaction(async (tx) => {
    const temporaryOrder = -1_000_000 - item.persistentId!;
    await tx.quiz_ablauf_elemente.update({
      where: { quiz_ablauf_element_id: item.persistentId! },
      data: { sortierung: temporaryOrder },
    });
    await tx.quiz_ablauf_elemente.update({
      where: { quiz_ablauf_element_id: target.quiz_ablauf_element_id },
      data: { sortierung: item.order },
    });
    await tx.quiz_ablauf_elemente.update({
      where: { quiz_ablauf_element_id: item.persistentId! },
      data: { sortierung: target.sortierung },
    });
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

function parseQuestionSequenceKey(itemKey: string) {
  const match = /^question:(\d+):(question|solution)$/.exec(itemKey);
  if (!match) return null;
  const questionAssignmentId = Number(match[1]);
  return Number.isSafeInteger(questionAssignmentId) && questionAssignmentId > 0
    ? { questionAssignmentId, type: match[2] === "question" ? "QUESTION" : "QUESTION_SOLUTION" }
    : null;
}

export async function moveQuizBlockSequenceItem(data: {
  quizId: number;
  sectionId: number;
  itemKey: string;
  direction: -1 | 1;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  await requireQuizQuestionSection(data.quizId, data.sectionId);
  await materializeQuizBlockQuestionItems(data.quizId, data.sectionId);

  const [quiz, section] = await Promise.all([
    prisma.quiz.findUniqueOrThrow({
      where: { quiz_id: data.quizId },
      select: { aufloesungsstrategie: true },
    }),
    prisma.quiz_abschnitte.findUniqueOrThrow({
      where: { quiz_abschnitt_id: data.sectionId },
      select: { aufloesungsstrategie: true },
    }),
  ]);
  const strategy = getEffectiveQuizSolutionStrategy(
    quiz.aufloesungsstrategie,
    section.aufloesungsstrategie,
  );
  const questionKey = parseQuestionSequenceKey(data.itemKey);
  const blockItemId = data.itemKey.startsWith("block-item:")
    ? Number(data.itemKey.slice("block-item:".length))
    : data.itemKey.startsWith("story-placement:")
      ? Number(data.itemKey.slice("story-placement:".length))
      : null;
  const current = await prisma.quiz_ablauf_elemente.findFirst({
    where: {
      quiz_id: data.quizId,
      quiz_abschnitt_id: data.sectionId,
      anker_typ: "BLOCK",
      ...(questionKey
        ? {
            quiz_fragen_id: questionKey.questionAssignmentId,
            typ: questionKey.type,
          }
        : Number.isSafeInteger(blockItemId) && Number(blockItemId) > 0
          ? { quiz_ablauf_element_id: Number(blockItemId) }
          : { quiz_ablauf_element_id: -1 }),
    },
  });
  if (!current) {
    return { success: false, message: "Blockelement wurde nicht gefunden." };
  }
  if (current.story_bezugs_quiz_fragen_id !== null) {
    return {
      success: false,
      message: "Verknüpfte Story-Elemente werden über ihre Position an der Frage angeordnet.",
    };
  }
  if (current.typ === "QUESTION_SOLUTION" && strategy !== "MANUAL") {
    return {
      success: false,
      message: "Automatisch platzierte Auflösungen werden über die Strategie verschoben.",
    };
  }

  const siblings = await prisma.quiz_ablauf_elemente.findMany({
    where: {
      quiz_id: data.quizId,
      quiz_abschnitt_id: data.sectionId,
      anker_typ: "BLOCK",
      ...(strategy === "MANUAL"
        ? {}
        : { typ: { not: "QUESTION_SOLUTION" } }),
    },
    orderBy: [{ sortierung: "asc" }, { quiz_ablauf_element_id: "asc" }],
  });
  const currentIndex = siblings.findIndex(
    (item) => item.quiz_ablauf_element_id === current.quiz_ablauf_element_id,
  );
  const target = siblings[currentIndex + data.direction];
  if (!target) return { success: true };

  if (strategy === "MANUAL") {
    const candidate = [...siblings];
    [candidate[currentIndex], candidate[currentIndex + data.direction]] = [
      candidate[currentIndex + data.direction],
      candidate[currentIndex],
    ];
    const questionIndexById = new Map<number, number>();
    for (const [index, item] of candidate.entries()) {
      if (item.typ === "QUESTION" && item.quiz_fragen_id !== null) {
        questionIndexById.set(item.quiz_fragen_id, index);
      }
      if (
        item.typ === "QUESTION_SOLUTION" &&
        (item.quiz_fragen_id === null ||
          (questionIndexById.get(item.quiz_fragen_id) ?? Number.POSITIVE_INFINITY) >= index)
      ) {
        return {
          success: false,
          message: "Eine Auflösung darf nicht vor ihrer Frage stehen.",
        };
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.quiz_ablauf_elemente.update({
      where: { quiz_ablauf_element_id: current.quiz_ablauf_element_id },
      data: {
        sortierung: -1_000_000 - current.quiz_ablauf_element_id,
      },
    });
    await tx.quiz_ablauf_elemente.update({
      where: { quiz_ablauf_element_id: target.quiz_ablauf_element_id },
      data: { sortierung: current.sortierung },
    });
    await tx.quiz_ablauf_elemente.update({
      where: { quiz_ablauf_element_id: current.quiz_ablauf_element_id },
      data: { sortierung: target.sortierung },
    });
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function updateQuizStoryPlacementOverride(data: {
  quizId: number;
  quizFragenId: number;
  storyElementId: number;
  placementOverride: StoryPlacementOverride;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  if (
    data.placementOverride !== null &&
    data.placementOverride !== "HIDDEN" &&
    !isStoryPlacement(data.placementOverride)
  ) {
    return { success: false, message: "Die Story-Position ist ungültig." };
  }
  const assignment = await prisma.quiz_fragen.findFirst({
    where: {
      quiz_fragen_id: data.quizFragenId,
      quiz_id: data.quizId,
      fragen: {
        story_element_verknuepfungen: {
          some: { story_element_id: data.storyElementId },
        },
      },
    },
    select: { quiz_abschnitt_id: true },
  });
  if (!assignment) {
    return {
      success: false,
      message: "Frage oder verknüpftes Story-Element wurde im Quiz nicht gefunden.",
    };
  }
  await materializeQuizQuestionStoryItems(data.quizId, data.quizFragenId);
  const placement = await prisma.quiz_ablauf_elemente.findFirst({
    where: {
      quiz_id: data.quizId,
      story_bezugs_quiz_fragen_id: data.quizFragenId,
      story_element_revision: { story_element_id: data.storyElementId },
    },
    select: { quiz_ablauf_element_id: true },
  });
  if (!placement) {
    return {
      success: false,
      message: "Die Story-Position konnte nicht materialisiert werden.",
    };
  }
  await prisma.quiz_ablauf_elemente.update({
    where: { quiz_ablauf_element_id: placement.quiz_ablauf_element_id },
    data: {
      story_beziehung: data.placementOverride === null ||
          data.placementOverride === "HIDDEN"
        ? null
        : storyPlacementToRelationship(data.placementOverride),
      ist_sichtbar:
        data.placementOverride !== "HIDDEN" &&
        assignment.quiz_abschnitt_id !== null,
      konfiguration: storyPlacementConfig(
        data.placementOverride === "HIDDEN",
      ),
    },
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function moveStandaloneStoryElementToSection(data: {
  quizId: number;
  placementId: number;
  sectionId: number | null;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  if (data.sectionId !== null) {
    await requireQuizQuestionSection(data.quizId, data.sectionId);
  }

  const placement = await prisma.quiz_ablauf_elemente.findFirst({
    where: {
      quiz_ablauf_element_id: data.placementId,
      quiz_id: data.quizId,
      story_element_revision_id: { not: null },
      story_bezugs_quiz_fragen_id: null,
    },
    select: {
      quiz_ablauf_element_id: true,
      story_element_revision: { select: { story_element_id: true } },
    },
  });
  if (!placement?.story_element_revision) {
    return { success: false, message: "Standalone-Story wurde nicht gefunden." };
  }
  const linkedQuestion = await prisma.frage_story_elemente.findFirst({
    where: { story_element_id: placement.story_element_revision.story_element_id },
    select: { frage_story_element_id: true },
  });
  if (linkedQuestion) {
    return {
      success: false,
      message: "Ein mit einer Frage verknüpftes Story-Element darf nicht frei verschoben werden.",
    };
  }

  await prisma.$transaction(async (tx) => {
    const anchorType = data.sectionId === null ? "BEFORE_QUIZ" : "BLOCK";
    const anchorKey = data.sectionId === null ? "UNASSIGNED" : String(data.sectionId);
    const last = await tx.quiz_ablauf_elemente.findFirst({
      where: {
        quiz_id: data.quizId,
        anker_typ: anchorType,
        anker_schluessel: anchorKey,
      },
      orderBy: [{ sortierung: "desc" }, { quiz_ablauf_element_id: "desc" }],
      select: { sortierung: true },
    });
    await tx.quiz_ablauf_elemente.update({
      where: { quiz_ablauf_element_id: data.placementId },
      data: {
        anker_typ: anchorType,
        anker_schluessel: anchorKey,
        quiz_abschnitt_id: data.sectionId,
        sortierung: (last?.sortierung ?? 0) + 1_000,
        ist_sichtbar: data.sectionId !== null,
      },
    });
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function moveStandaloneLivePollToSection(data: {
  quizId: number;
  placementId: number;
  sectionId: number | null;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  if (data.sectionId !== null) {
    await requireQuizQuestionSection(data.quizId, data.sectionId);
  }
  const placement = await prisma.quiz_ablauf_elemente.findFirst({
    where: {
      quiz_ablauf_element_id: data.placementId,
      quiz_id: data.quizId,
      typ: "LIVE_POLL",
      live_poll_revision_id: { not: null },
    },
    select: { quiz_ablauf_element_id: true },
  });
  if (!placement) return { success: false, message: "Umfrage-Platzierung wurde nicht gefunden." };

  await prisma.$transaction(async (tx) => {
    const anchorType = data.sectionId === null ? "BEFORE_QUIZ" : "BLOCK";
    const anchorKey = data.sectionId === null ? "UNASSIGNED" : String(data.sectionId);
    const last = await tx.quiz_ablauf_elemente.findFirst({
      where: { quiz_id: data.quizId, anker_typ: anchorType, anker_schluessel: anchorKey },
      orderBy: [{ sortierung: "desc" }, { quiz_ablauf_element_id: "desc" }],
      select: { sortierung: true },
    });
    await tx.quiz_ablauf_elemente.update({
      where: { quiz_ablauf_element_id: placement.quiz_ablauf_element_id },
      data: {
        anker_typ: anchorType,
        anker_schluessel: anchorKey,
        quiz_abschnitt_id: data.sectionId,
        sortierung: (last?.sortierung ?? 0) + 1_000,
        ist_sichtbar: data.sectionId !== null,
      },
    });
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

function editorSequenceKey(item: {
  typ: string;
  quiz_ablauf_element_id: number;
  quiz_fragen_id: number | null;
  story_element_revision_id: number | null;
  live_poll_revision_id: number | null;
}) {
  if (item.typ === "QUESTION" && item.quiz_fragen_id !== null) {
    return `question-${item.quiz_fragen_id}`;
  }
  if (item.live_poll_revision_id !== null) {
    return `poll-${item.quiz_ablauf_element_id}`;
  }
  if (item.story_element_revision_id !== null) {
    return `story-${item.quiz_ablauf_element_id}`;
  }
  return null;
}

export async function updateQuizEditorElementSequence(data: {
  quizId: number;
  sectionId: number | null;
  itemKeys: string[];
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  if (data.sectionId !== null) {
    await requireQuizQuestionSection(data.quizId, data.sectionId);
    await materializeQuizBlockQuestionItems(data.quizId, data.sectionId);
  }

  const questions = await prisma.quiz_fragen.findMany({
    where: { quiz_id: data.quizId, quiz_abschnitt_id: data.sectionId },
    select: { quiz_fragen_id: true },
  });
  if (data.sectionId === null) {
    for (const question of questions) {
      await prisma.quiz_ablauf_elemente.upsert({
        where: {
          quiz_id_typ_quiz_fragen_id: {
            quiz_id: data.quizId,
            typ: "QUESTION",
            quiz_fragen_id: question.quiz_fragen_id,
          },
        },
        create: {
          quiz_id: data.quizId,
          typ: "QUESTION",
          anker_typ: "BEFORE_QUIZ",
          anker_schluessel: "UNASSIGNED",
          quiz_fragen_id: question.quiz_fragen_id,
          sortierung: 0,
          ist_sichtbar: false,
          konfiguration: { version: 1 },
          konfigurations_version: 1,
          ist_standard: true,
        },
        update: {
          anker_typ: "BEFORE_QUIZ",
          anker_schluessel: "UNASSIGNED",
          quiz_abschnitt_id: null,
          ist_sichtbar: false,
        },
      });
    }
  }

  const placements = await prisma.quiz_ablauf_elemente.findMany({
    where: {
      quiz_id: data.quizId,
      quiz_abschnitt_id: data.sectionId,
      OR: [
        { typ: "QUESTION", quiz_fragen_id: { not: null } },
        {
          story_element_revision_id: { not: null },
          story_bezugs_quiz_fragen_id: null,
        },
        { typ: "LIVE_POLL", live_poll_revision_id: { not: null } },
      ],
    },
    select: {
      quiz_ablauf_element_id: true,
      typ: true,
      quiz_fragen_id: true,
      story_element_revision_id: true,
      live_poll_revision_id: true,
    },
  });
  const placementByKey = new Map(
    placements.flatMap((item) => {
      const key = editorSequenceKey(item);
      return key ? [[key, item] as const] : [];
    }),
  );
  if (
    new Set(data.itemKeys).size !== data.itemKeys.length ||
    data.itemKeys.length !== placementByKey.size ||
    data.itemKeys.some((key) => !placementByKey.has(key))
  ) {
    return {
      success: false,
      message: "Die Elementreihenfolge ist unvollständig oder ungültig.",
    };
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, key] of data.itemKeys.entries()) {
      await tx.quiz_ablauf_elemente.update({
        where: {
          quiz_ablauf_element_id: placementByKey.get(key)!.quiz_ablauf_element_id,
        },
        data: { sortierung: -1_000_000 - index },
      });
    }
    for (const [index, key] of data.itemKeys.entries()) {
      await tx.quiz_ablauf_elemente.update({
        where: {
          quiz_ablauf_element_id: placementByKey.get(key)!.quiz_ablauf_element_id,
        },
        data: { sortierung: (index + 1) * 1_000 },
      });
    }
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function removeStandaloneLivePollFromQuiz(data: {
  quizId: number;
  placementId: number;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  const deleted = await prisma.quiz_ablauf_elemente.deleteMany({
    where: {
      quiz_ablauf_element_id: data.placementId,
      quiz_id: data.quizId,
      typ: "LIVE_POLL",
      live_poll_revision_id: { not: null },
    },
  });
  if (deleted.count !== 1) return { success: false, message: "Umfrage-Platzierung wurde nicht gefunden." };
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function updateQuizDefaultSolutionStrategy(data: {
  quizId: number;
  strategy: QuizSolutionStrategy;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  if (!isQuizSolutionStrategy(data.strategy)) {
    return { success: false, message: "Die Auflösungsstrategie ist ungültig." };
  }
  const sections = await prisma.$transaction(async (tx) => {
    await tx.quiz.update({
      where: { quiz_id: data.quizId },
      data: { aufloesungsstrategie: data.strategy },
    });
    await tx.quiz_abschnitte.updateMany({
      where: { quiz_id: data.quizId },
      data: { aufloesungsstrategie: null },
    });
    return tx.quiz_abschnitte.findMany({
      where: { quiz_id: data.quizId },
      select: { quiz_abschnitt_id: true },
    });
  });
  if (data.strategy === "MANUAL") {
    for (const section of sections) {
      await materializeManualQuizBlockSequence(
        data.quizId,
        section.quiz_abschnitt_id,
      );
    }
  }
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function updateQuizBlockSolutionStrategy(data: {
  quizId: number;
  sectionId: number;
  strategy: QuizSolutionStrategy | null;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  await requireQuizQuestionSection(data.quizId, data.sectionId);
  if (data.strategy !== null && !isQuizSolutionStrategy(data.strategy)) {
    return { success: false, message: "Die Auflösungsstrategie ist ungültig." };
  }
  const quiz = await prisma.quiz.findUniqueOrThrow({
    where: { quiz_id: data.quizId },
    select: { aufloesungsstrategie: true },
  });
  const targetStrategy = getEffectiveQuizSolutionStrategy(
    quiz.aufloesungsstrategie,
    data.strategy,
  );
  if (targetStrategy === "MANUAL") {
    await materializeManualQuizBlockSequence(data.quizId, data.sectionId);
  }
  await prisma.quiz_abschnitte.update({
    where: { quiz_abschnitt_id: data.sectionId },
    data: { aufloesungsstrategie: data.strategy },
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function updateQuizBlockEditorialDetails(data: {
  quizId: number;
  sectionId: number;
  title: string;
  note: string;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  await requireQuizQuestionSection(data.quizId, data.sectionId);
  const title = data.title.trim();
  const note = data.note.trim();
  if (!title || title.length > 200 || note.length > 2_000) {
    return { success: false, message: "Titel oder Blocknotiz ist ungültig." };
  }
  await prisma.quiz_abschnitte.update({
    where: { quiz_abschnitt_id: data.sectionId },
    data: { titel: title, bemerkung: note || null },
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function deleteQuizFlowItem(data: {
  quizId: number;
  itemId: string;
}): Promise<FlowActionResult> {
  await requireQuizEditor(data.quizId);
  const item = await resolveEditableQuizFlowItem(data.quizId, data.itemId);
  if (!item?.persistentId) {
    return { success: false, message: "Ablaufelement wurde nicht gefunden." };
  }
  if (item.isStandard) {
    return {
      success: false,
      message: "Standardelemente können ausgeblendet, aber nicht gelöscht werden.",
    };
  }
  await prisma.quiz_ablauf_elemente.delete({
    where: { quiz_ablauf_element_id: item.persistentId },
  });
  revalidateQuizFlow(data.quizId);
  return { success: true };
}

export async function resetQuizFlow(quizId: number): Promise<FlowActionResult> {
  await requireQuizEditor(quizId);
  await prisma.$transaction([
    prisma.quiz_ablauf_elemente.deleteMany({
      where: { quiz_id: quizId, anker_typ: { not: "BLOCK" } },
    }),
    prisma.quiz_praesentation_status.updateMany({
      where: { quiz_id: quizId },
      data: { slide_index: 0, slide_key: null },
    }),
  ]);
  revalidateQuizFlow(quizId);
  return { success: true };
}
