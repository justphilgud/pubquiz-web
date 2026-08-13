import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  buildDefaultQuizFlow,
  parseStoredQuizFlowItem,
  type QuizFlowItem,
  type StoredQuizFlowItem,
} from "./quizFlow";
import { resolveQuizBlockSequence } from "./quizBlockSequence";
import { isStoryPlacementHiddenConfig } from "@/app/story-elemente/storyPlacement";

const flowQuizInclude = {
  quiz_abschnitte: { orderBy: { sortierung: "asc" as const } },
  quiz_fragen: { select: { quiz_abschnitt_id: true } },
  quiz_ablauf_elemente: {
    orderBy: [
      { anker_typ: "asc" as const },
      { anker_schluessel: "asc" as const },
      { sortierung: "asc" as const },
    ],
    include: {
      story_element_revision: {
        select: {
          story_element_revision_id: true,
          story_element_id: true,
          typ: true,
          titel: true,
          moderationsnotiz: true,
          konfiguration: true,
        },
      },
      story_bezugs_frage: {
        select: {
          fragen: {
            select: {
              story_element_verknuepfungen: {
                select: { story_element_id: true, beziehung: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.quizInclude;

type StoredItemSource = {
  quiz_ablauf_element_id: number;
  typ: string;
  anker_typ: string;
  anker_schluessel: string;
  quiz_abschnitt_id: number | null;
  quiz_fragen_id: number | null;
  story_element_revision_id?: number | null;
  story_bezugs_quiz_fragen_id?: number | null;
  story_beziehung?: string | null;
  story_bezugs_frage?: {
    fragen: {
      story_element_verknuepfungen: Array<{
        story_element_id: number;
        beziehung: string;
      }>;
    };
  } | null;
  sortierung: number;
  ist_sichtbar: boolean;
  bezeichnung: string | null;
  konfiguration: unknown;
  konfigurations_version: number;
  ist_standard: boolean;
  story_element_revision?: {
    story_element_revision_id: number;
    story_element_id: number;
    typ: string;
    titel: string;
    moderationsnotiz: string | null;
    konfiguration: unknown;
  } | null;
};

function hydrateStoryRevisionConfig(item: StoredItemSource) {
  const revision = item.story_element_revision;
  if (!revision) return item.konfiguration;
  const config = typeof revision.konfiguration === "object" &&
      revision.konfiguration !== null &&
      !Array.isArray(revision.konfiguration)
    ? revision.konfiguration as Record<string, unknown>
    : {};
  return {
    ...config,
    version: 1,
    title: revision.titel,
    ...(revision.moderationsnotiz
      ? { moderatorNote: revision.moderationsnotiz }
      : {}),
  };
}

export function toStoredQuizFlowItem(
  item: StoredItemSource,
): StoredQuizFlowItem {
  const revision = item.story_element_revision;
  const defaultRelationship = revision
    ? item.story_bezugs_frage?.fragen.story_element_verknuepfungen.find(
        (link) => link.story_element_id === revision.story_element_id,
      )?.beziehung ?? null
    : null;
  return {
    quiz_ablauf_element_id: item.quiz_ablauf_element_id,
    typ: revision?.typ ?? item.typ,
    anker_typ: item.anker_typ,
    anker_schluessel: item.anker_schluessel,
    quiz_abschnitt_id: item.quiz_abschnitt_id,
    quiz_fragen_id: item.quiz_fragen_id,
    story_element_id: revision?.story_element_id ?? null,
    story_element_revision_id: item.story_element_revision_id ?? null,
    story_bezugs_quiz_fragen_id: item.story_bezugs_quiz_fragen_id ?? null,
    story_beziehung: item.story_beziehung ?? null,
    story_default_beziehung: defaultRelationship,
    sortierung: item.sortierung,
    ist_sichtbar: item.ist_sichtbar,
    bezeichnung: item.bezeichnung ?? revision?.titel ?? null,
    konfiguration: hydrateStoryRevisionConfig(item),
    konfigurations_version: item.konfigurations_version,
    ist_standard: item.ist_standard,
  };
}

export async function loadStoredQuizFlowItems(quizId: number) {
  return prisma.quiz_ablauf_elemente.findMany({
    where: { quiz_id: quizId },
    orderBy: [
      { anker_typ: "asc" },
      { anker_schluessel: "asc" },
      { sortierung: "asc" },
    ],
    include: {
      story_element_revision: {
        select: {
          story_element_revision_id: true,
          story_element_id: true,
          typ: true,
          titel: true,
          moderationsnotiz: true,
          konfiguration: true,
        },
      },
      story_bezugs_frage: {
        select: {
          fragen: {
            select: {
              story_element_verknuepfungen: {
                select: { story_element_id: true, beziehung: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function materializeDefaultQuizFlow(
  quizId: number,
): Promise<QuizFlowItem[]> {
  return prisma.$transaction(async (tx) => {
    const quiz = await tx.quiz.findUnique({
      where: { quiz_id: quizId },
      include: flowQuizInclude,
    });
    if (!quiz) throw new Error("Quiz nicht gefunden.");

    const defaults = buildDefaultQuizFlow({
      ...quiz,
      abschnitte: quiz.quiz_abschnitte,
      fragen: quiz.quiz_fragen,
    });
    const existingStandardKeys = new Set(
      quiz.quiz_ablauf_elemente
        .filter((item) => item.ist_standard)
        .map(
          (item) =>
            `${item.anker_typ}:${item.anker_schluessel}:${item.typ}`,
        ),
    );
    const missingDefaults = defaults.filter(
      (item) =>
        !existingStandardKeys.has(
          `${item.anchorType}:${item.anchorKey}:${item.type}`,
        ),
    );
    if (missingDefaults.length > 0) {
      const occupiedOrders = new Map<string, Set<number>>();
      for (const item of quiz.quiz_ablauf_elemente) {
        const key = `${item.anker_typ}:${item.anker_schluessel}`;
        const orders = occupiedOrders.get(key) ?? new Set<number>();
        orders.add(item.sortierung);
        occupiedOrders.set(key, orders);
      }
      await tx.quiz_ablauf_elemente.createMany({
        data: missingDefaults.map((item) => {
          const key = `${item.anchorType}:${item.anchorKey}`;
          const orders = occupiedOrders.get(key) ?? new Set<number>();
          let order = item.order;
          while (orders.has(order)) order += 1;
          orders.add(order);
          occupiedOrders.set(key, orders);
          return {
            quiz_id: quizId,
            typ: item.type,
            anker_typ: item.anchorType,
            anker_schluessel: item.anchorKey,
            quiz_abschnitt_id: item.sectionId,
            sortierung: order,
            ist_sichtbar: item.enabled,
            bezeichnung: item.label,
            konfiguration: item.config as Prisma.InputJsonValue,
            konfigurations_version: item.configVersion,
            ist_standard: true,
          };
        }),
        skipDuplicates: true,
      });
    }

    const stored = await tx.quiz_ablauf_elemente.findMany({
      where: { quiz_id: quizId },
      orderBy: [
        { anker_typ: "asc" },
        { anker_schluessel: "asc" },
        { sortierung: "asc" },
      ],
      include: {
        story_element_revision: {
          select: {
            story_element_revision_id: true,
            story_element_id: true,
            typ: true,
            titel: true,
            moderationsnotiz: true,
            konfiguration: true,
          },
        },
      },
    });
    return stored
      .map((item) => parseStoredQuizFlowItem(toStoredQuizFlowItem(item)))
      .filter((item): item is QuizFlowItem => item !== null);
  });
}

export async function resolveEditableQuizFlowItem(
  quizId: number,
  runtimeId: string,
) {
  const materialized = await materializeDefaultQuizFlow(quizId);
  const directId = runtimeId.startsWith("flow:")
    ? Number(runtimeId.slice("flow:".length))
    : null;
  if (directId !== null && Number.isInteger(directId)) {
    return materialized.find((item) => item.persistentId === directId) ?? null;
  }
  if (!runtimeId.startsWith("default:")) return null;

  const [, anchorType, anchorKey, type] = runtimeId.split(":");
  return (
    materialized.find(
      (item) =>
        item.anchorType === anchorType &&
        item.anchorKey === anchorKey &&
        item.type === type &&
        item.isStandard,
    ) ?? null
  );
}

async function ensureQuizBlockQuestionItems(
  tx: Prisma.TransactionClient,
  quizId: number,
  sectionId: number,
) {
  // Serialise materialisation for one quiz so concurrent block moves cannot
  // create a linked story placement in both its old and new block.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(42001, ${quizId})`;

  const section = await tx.quiz_abschnitte.findFirst({
    where: { quiz_abschnitt_id: sectionId, quiz_id: quizId },
    select: { quiz_abschnitt_id: true },
  });
  if (!section) throw new Error("Quizblock wurde nicht gefunden.");

  const questions = await tx.quiz_fragen.findMany({
    where: { quiz_id: quizId, quiz_abschnitt_id: sectionId },
    orderBy: [{ sortierung: "asc" }, { quiz_fragen_id: "asc" }],
    select: {
      quiz_fragen_id: true,
      fragen_id: true,
      quiz_abschnitt_id: true,
      sortierung: true,
      verknuepfte_story_elemente_uebernehmen: true,
    },
  });
  const existing = await tx.quiz_ablauf_elemente.findMany({
    where: {
      quiz_id: quizId,
      OR: [
        {
          anker_typ: "BLOCK",
          quiz_abschnitt_id: sectionId,
        },
        {
          typ: { in: ["QUESTION", "QUESTION_SOLUTION"] },
          quiz_fragen_id: { in: questions.map((question) => question.quiz_fragen_id) },
        },
      ],
    },
    orderBy: [{ sortierung: "asc" }, { quiz_ablauf_element_id: "asc" }],
  });
  let nextOrder = Math.max(0, ...existing.map((item) => item.sortierung)) + 1_000;
  const questionItemByAssignment = new Map(
    existing
      .filter(
        (item) => item.typ === "QUESTION" && item.quiz_fragen_id !== null,
      )
      .map((item) => [item.quiz_fragen_id!, item]),
  );

  for (const question of questions) {
    const item = questionItemByAssignment.get(question.quiz_fragen_id);
    if (item) {
      if (
        item.quiz_abschnitt_id !== sectionId ||
        item.anker_typ !== "BLOCK" ||
        item.anker_schluessel !== String(sectionId)
      ) {
        await tx.quiz_ablauf_elemente.update({
          where: { quiz_ablauf_element_id: item.quiz_ablauf_element_id },
          data: {
            anker_typ: "BLOCK",
            anker_schluessel: String(sectionId),
            quiz_abschnitt_id: sectionId,
            sortierung: nextOrder,
          },
        });
        nextOrder += 1_000;
      }
      continue;
    }
    await tx.quiz_ablauf_elemente.create({
      data: {
        quiz_id: quizId,
        typ: "QUESTION",
        anker_typ: "BLOCK",
        anker_schluessel: String(sectionId),
        quiz_abschnitt_id: sectionId,
        quiz_fragen_id: question.quiz_fragen_id,
        sortierung: nextOrder,
        ist_sichtbar: true,
        konfiguration: { version: 1 },
        konfigurations_version: 1,
        ist_standard: true,
      },
    });
    nextOrder += 1_000;
  }

  for (const item of existing.filter(
    (entry) =>
      entry.typ === "QUESTION_SOLUTION" &&
      entry.quiz_fragen_id !== null &&
      questions.some(
        (question) => question.quiz_fragen_id === entry.quiz_fragen_id,
      ) &&
      (entry.quiz_abschnitt_id !== sectionId ||
        entry.anker_typ !== "BLOCK" ||
        entry.anker_schluessel !== String(sectionId)),
  )) {
    await tx.quiz_ablauf_elemente.update({
      where: { quiz_ablauf_element_id: item.quiz_ablauf_element_id },
      data: {
        anker_typ: "BLOCK",
        anker_schluessel: String(sectionId),
        quiz_abschnitt_id: sectionId,
        sortierung: nextOrder,
      },
    });
    nextOrder += 1_000;
  }

  const quiz = await tx.quiz.findUniqueOrThrow({
    where: { quiz_id: quizId },
    select: { eventreihe_id: true },
  });
  const linkedStories = await tx.frage_story_elemente.findMany({
    where: {
      fragen_id: {
        in: questions
          .filter((question) => question.verknuepfte_story_elemente_uebernehmen)
          .map((question) => question.fragen_id),
      },
      story_element: {
        status: "ACTIVE",
        OR: [
          { geltungsbereich: "GLOBAL" },
          { geltungsbereich: "EVENT_SERIES", eventreihe_id: quiz.eventreihe_id },
          { geltungsbereich: "QUIZ", quiz_id: quizId },
        ],
      },
    },
    include: {
      story_element: {
        include: {
          revisionen: {
            orderBy: { revisionsnummer: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ sortierung: "asc" }, { frage_story_element_id: "asc" }],
  });
  const questionAssignmentByQuestionId = new Map(
    questions.map((question) => [question.fragen_id, question.quiz_fragen_id]),
  );
  const existingStoryPlacements = await tx.quiz_ablauf_elemente.findMany({
    where: {
      quiz_id: quizId,
      story_element_revision_id: { not: null },
    },
    include: {
      story_element_revision: { select: { story_element_id: true } },
    },
  });
  const existingStoryPlacementById = new Map(
    existingStoryPlacements.flatMap((placement) =>
      placement.story_element_revision
        ? [[placement.story_element_revision.story_element_id, placement] as const]
        : [],
    ),
  );
  const occupiedOrders = new Set(
    (await tx.quiz_ablauf_elemente.findMany({
      where: { quiz_id: quizId, quiz_abschnitt_id: sectionId, anker_typ: "BLOCK" },
      select: { sortierung: true },
    })).map((item) => item.sortierung),
  );
  const questionOrderByAssignment = new Map(
    (await tx.quiz_ablauf_elemente.findMany({
      where: {
        quiz_id: quizId,
        quiz_abschnitt_id: sectionId,
        anker_typ: "BLOCK",
        typ: "QUESTION",
      },
      select: { quiz_fragen_id: true, sortierung: true },
    })).flatMap((item) =>
      item.quiz_fragen_id === null ? [] : [[item.quiz_fragen_id, item.sortierung] as const],
    ),
  );
  for (const linked of linkedStories) {
    const questionAssignmentId = questionAssignmentByQuestionId.get(linked.fragen_id);
    const revision = linked.story_element.revisionen[0];
    if (!questionAssignmentId || !revision) continue;
    const existingPlacement = existingStoryPlacementById.get(
      linked.story_element_id,
    );
    if (existingPlacement) {
      if (
        existingPlacement.story_bezugs_quiz_fragen_id === questionAssignmentId &&
        (existingPlacement.quiz_abschnitt_id !== sectionId ||
          existingPlacement.anker_typ !== "BLOCK" ||
          existingPlacement.anker_schluessel !== String(sectionId) ||
          (!existingPlacement.ist_sichtbar &&
            !isStoryPlacementHiddenConfig(existingPlacement.konfiguration)))
      ) {
        let order = (questionOrderByAssignment.get(questionAssignmentId) ?? nextOrder) + 100;
        while (occupiedOrders.has(order)) order += 10;
        occupiedOrders.add(order);
        await tx.quiz_ablauf_elemente.update({
          where: {
            quiz_ablauf_element_id:
              existingPlacement.quiz_ablauf_element_id,
          },
          data: {
            anker_typ: "BLOCK",
            anker_schluessel: String(sectionId),
            quiz_abschnitt_id: sectionId,
            sortierung: order,
            ist_sichtbar: !isStoryPlacementHiddenConfig(
              existingPlacement.konfiguration,
            ),
          },
        });
      }
      continue;
    }
    let order = (questionOrderByAssignment.get(questionAssignmentId) ?? nextOrder) + 100;
    while (occupiedOrders.has(order)) order += 10;
    occupiedOrders.add(order);
    await tx.quiz_ablauf_elemente.create({
      data: {
        quiz_id: quizId,
        typ: revision.typ,
        anker_typ: "BLOCK",
        anker_schluessel: String(sectionId),
        quiz_abschnitt_id: sectionId,
        story_element_revision_id: revision.story_element_revision_id,
        story_bezugs_quiz_fragen_id: questionAssignmentId,
        story_beziehung: null,
        sortierung: order,
        ist_sichtbar: true,
        bezeichnung: revision.titel,
        konfiguration: { version: 1 },
        konfigurations_version: 1,
        ist_standard: false,
      },
    });
  }

  return questions;
}

export async function materializeQuizBlockQuestionItems(
  quizId: number,
  sectionId: number,
) {
  return prisma.$transaction((tx) =>
    ensureQuizBlockQuestionItems(tx, quizId, sectionId),
  );
}

export async function materializeQuizQuestionStoryItems(
  quizId: number,
  questionAssignmentId: number,
) {
  const assignment = await prisma.quiz_fragen.findFirst({
    where: { quiz_id: quizId, quiz_fragen_id: questionAssignmentId },
    select: {
      quiz_abschnitt_id: true,
      verknuepfte_story_elemente_uebernehmen: true,
    },
  });
  if (!assignment?.verknuepfte_story_elemente_uebernehmen) return;
  if (assignment.quiz_abschnitt_id !== null) {
    await materializeQuizBlockQuestionItems(quizId, assignment.quiz_abschnitt_id);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(42001, ${quizId})`;
    const current = await tx.quiz_fragen.findFirst({
      where: { quiz_id: quizId, quiz_fragen_id: questionAssignmentId },
      select: {
        fragen_id: true,
        verknuepfte_story_elemente_uebernehmen: true,
        quiz: { select: { eventreihe_id: true } },
      },
    });
    if (!current?.verknuepfte_story_elemente_uebernehmen) return;
    const links = await tx.frage_story_elemente.findMany({
      where: {
        fragen_id: current.fragen_id,
        story_element: {
          status: "ACTIVE",
          OR: [
            { geltungsbereich: "GLOBAL" },
            { geltungsbereich: "EVENT_SERIES", eventreihe_id: current.quiz.eventreihe_id },
            { geltungsbereich: "QUIZ", quiz_id: quizId },
          ],
        },
      },
      orderBy: [{ sortierung: "asc" }, { frage_story_element_id: "asc" }],
      include: {
        story_element: {
          include: {
            revisionen: { orderBy: { revisionsnummer: "desc" }, take: 1 },
          },
        },
      },
    });
    const last = await tx.quiz_ablauf_elemente.findFirst({
      where: { quiz_id: quizId, anker_typ: "BEFORE_QUIZ", anker_schluessel: "UNASSIGNED" },
      orderBy: [{ sortierung: "desc" }, { quiz_ablauf_element_id: "desc" }],
      select: { sortierung: true },
    });
    let nextOrder = (last?.sortierung ?? 0) + 1_000;
    for (const link of links) {
      const revision = link.story_element.revisionen[0];
      if (!revision) continue;
      const existing = await tx.quiz_ablauf_elemente.findFirst({
        where: {
          quiz_id: quizId,
          story_element_revision: { story_element_id: link.story_element_id },
        },
        select: { quiz_ablauf_element_id: true },
      });
      if (existing) continue;
      await tx.quiz_ablauf_elemente.create({
        data: {
          quiz_id: quizId,
          typ: revision.typ,
          anker_typ: "BEFORE_QUIZ",
          anker_schluessel: "UNASSIGNED",
          quiz_abschnitt_id: null,
          story_element_revision_id: revision.story_element_revision_id,
          story_bezugs_quiz_fragen_id: questionAssignmentId,
          story_beziehung: null,
          sortierung: nextOrder,
          ist_sichtbar: false,
          bezeichnung: revision.titel,
          konfiguration: { version: 1 },
          konfigurations_version: 1,
          ist_standard: false,
        },
      });
      nextOrder += 1_000;
    }
  });
}

export async function synchronizeQuizBlockQuestionItems(quizId: number) {
  const sections = await prisma.quiz_abschnitte.findMany({
    where: { quiz_id: quizId, abschnitt_typ: { in: ["fragenblock", "fragenrunde"] } },
    select: { quiz_abschnitt_id: true },
  });
  for (const section of sections) {
    await materializeQuizBlockQuestionItems(quizId, section.quiz_abschnitt_id);
  }
}

export async function materializeManualQuizBlockSequence(
  quizId: number,
  sectionId: number,
) {
  return prisma.$transaction(async (tx) => {
    const questions = await ensureQuizBlockQuestionItems(tx, quizId, sectionId);
    const [quiz, section, storedItems] = await Promise.all([
      tx.quiz.findUniqueOrThrow({
        where: { quiz_id: quizId },
        select: { aufloesungsstrategie: true },
      }),
      tx.quiz_abschnitte.findUniqueOrThrow({
        where: { quiz_abschnitt_id: sectionId },
        select: { aufloesungsstrategie: true },
      }),
      tx.quiz_ablauf_elemente.findMany({
        where: {
          quiz_id: quizId,
          anker_typ: "BLOCK",
          quiz_abschnitt_id: sectionId,
        },
        orderBy: [{ sortierung: "asc" }, { quiz_ablauf_element_id: "asc" }],
        include: {
          story_element_revision: {
            select: {
              story_element_revision_id: true,
              story_element_id: true,
              typ: true,
              titel: true,
              moderationsnotiz: true,
              konfiguration: true,
            },
          },
        },
      }),
    ]);
    const parsedItems = storedItems
      .map((item) => parseStoredQuizFlowItem(toStoredQuizFlowItem(item)))
      .filter((item): item is QuizFlowItem => item !== null);
    const sequence = resolveQuizBlockSequence({
      sectionId,
      quizStrategy: quiz.aufloesungsstrategie,
      sectionStrategy: section.aufloesungsstrategie,
      questions,
      blockItems: parsedItems,
      includeDisabledItems: true,
    }).entries;

    for (const item of storedItems) {
      await tx.quiz_ablauf_elemente.update({
        where: { quiz_ablauf_element_id: item.quiz_ablauf_element_id },
        data: { sortierung: -10_000_000 - item.quiz_ablauf_element_id },
      });
    }

    const persistentIdByQuestion = new Map(
      storedItems
        .filter(
          (item) => item.typ === "QUESTION" && item.quiz_fragen_id !== null,
        )
        .map((item) => [item.quiz_fragen_id!, item.quiz_ablauf_element_id]),
    );
    const persistentIdBySolution = new Map(
      storedItems
        .filter(
          (item) =>
            item.typ === "QUESTION_SOLUTION" && item.quiz_fragen_id !== null,
        )
        .map((item) => [item.quiz_fragen_id!, item.quiz_ablauf_element_id]),
    );

    for (const [index, entry] of sequence.entries()) {
      let persistentId: number;
      if (entry.kind === "CONTENT") {
        if (entry.item.persistentId === null) continue;
        persistentId = entry.item.persistentId;
      } else if (entry.kind === "QUESTION") {
        const existingId = persistentIdByQuestion.get(
          entry.question.quiz_fragen_id,
        );
        if (!existingId) throw new Error("Fragenposition konnte nicht materialisiert werden.");
        persistentId = existingId;
      } else {
        const existingId = persistentIdBySolution.get(
          entry.question.quiz_fragen_id,
        );
        if (existingId) {
          persistentId = existingId;
        } else {
          const created = await tx.quiz_ablauf_elemente.create({
            data: {
              quiz_id: quizId,
              typ: "QUESTION_SOLUTION",
              anker_typ: "BLOCK",
              anker_schluessel: String(sectionId),
              quiz_abschnitt_id: sectionId,
              quiz_fragen_id: entry.question.quiz_fragen_id,
              sortierung: -20_000_000 - entry.question.quiz_fragen_id,
              ist_sichtbar: true,
              konfiguration: { version: 1 },
              konfigurations_version: 1,
              ist_standard: true,
            },
            select: { quiz_ablauf_element_id: true },
          });
          persistentId = created.quiz_ablauf_element_id;
          persistentIdBySolution.set(
            entry.question.quiz_fragen_id,
            persistentId,
          );
        }
      }
      await tx.quiz_ablauf_elemente.update({
        where: { quiz_ablauf_element_id: persistentId },
        data: { sortierung: (index + 1) * 1_000 },
      });
    }

    return sequence;
  });
}
