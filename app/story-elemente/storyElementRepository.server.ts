import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  getActorEventSeriesIds,
  isAdministrator,
  type AuthorizationActor,
} from "@/app/roles/roleAssignmentPolicy";
import {
  canAttachStoryElementToQuiz,
  canUseStoryElementScope,
  canViewStoryElement,
  type StoryElementAccessContext,
} from "./storyElementPolicy";
import {
  isStoryElementScope,
  isStoryElementStatus,
  isStoryElementType,
  type StoryElementScopeValue,
  type StoryElementStatusValue,
} from "./storyElement";

export type StoryElementFilters = {
  query?: string;
  status?: string;
  type?: string;
  scope?: string;
  eventSeriesId?: string;
  creator?: string;
  mediaState?: string;
  usageState?: string;
};

function getStoryMediaCount(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return 0;
  const value = config as Record<string, unknown>;
  const direct = ["imageUrl", "audioUrl", "videoUrl", "posterImageUrl"]
    .filter((key) => typeof value[key] === "string" && value[key] !== "").length;
  return direct + (Array.isArray(value.images) ? value.images.length : 0);
}

const storyElementInclude = {
  eventreihe: { select: { eventreihe_id: true, name: true } },
  quiz: {
    select: {
      quiz_id: true,
      titel: true,
      eventreihe_id: true,
      eventreihe: { select: { name: true } },
    },
  },
  created_by: { select: { id: true, name: true, email: true } },
  revisionen: {
    orderBy: { revisionsnummer: "desc" as const },
    include: {
      created_by: { select: { id: true, name: true, email: true } },
      quiz_ablauf_elemente: {
        select: {
          quiz: {
            select: {
              quiz_id: true,
              titel: true,
              quiz_datum: true,
              ist_archiviert: true,
            },
          },
        },
      },
      _count: { select: { quiz_ablauf_elemente: true } },
    },
  },
  _count: { select: { fragen_verknuepfungen: true } },
} satisfies Prisma.story_elementeInclude;

function buildVisibilityWhere(actor: AuthorizationActor): Prisma.story_elementeWhereInput {
  if (isAdministrator(actor)) return {};
  const eventSeriesIds = getActorEventSeriesIds(actor);
  return {
    OR: [
      { geltungsbereich: "GLOBAL" },
      { geltungsbereich: "EVENT_SERIES", eventreihe_id: { in: eventSeriesIds } },
      { geltungsbereich: "QUIZ", quiz: { eventreihe_id: { in: eventSeriesIds } } },
    ],
  };
}

function toAccessContext(
  story: {
    geltungsbereich: StoryElementScopeValue;
    eventreihe_id: number | null;
    quiz_id: number | null;
    quiz: { eventreihe_id: number } | null;
    created_by_user_id: number | null;
    status: StoryElementStatusValue;
  },
): StoryElementAccessContext {
  return {
    scope: story.geltungsbereich,
    eventSeriesId: story.eventreihe_id,
    quizId: story.quiz_id,
    quizEventSeriesId: story.quiz?.eventreihe_id ?? null,
    createdByUserId: story.created_by_user_id,
    status: story.status,
  };
}

function mapStoryElement(
  story: Awaited<ReturnType<typeof queryStoryElements>>[number],
) {
  const latest = story.revisionen[0];
  if (!latest || !isStoryElementType(latest.typ)) return null;
  return {
    id: story.story_element_id,
    stableKey: story.stable_key,
    status: story.status,
    scope: story.geltungsbereich,
    eventSeriesId: story.eventreihe_id,
    eventSeriesName: story.eventreihe?.name ?? story.quiz?.eventreihe.name ?? null,
    quizId: story.quiz_id,
    quizTitle: story.quiz?.titel ?? null,
    createdByUserId: story.created_by_user_id,
    creatorName: story.created_by?.name ?? story.created_by?.email ?? null,
    sourceStoryElementId: story.source_story_element_id,
    archivedAt: story.archived_at,
    createdAt: story.created_at,
    updatedAt: story.updated_at,
    revisionId: latest.story_element_revision_id,
    revisionNumber: latest.revisionsnummer,
    type: latest.typ,
    title: latest.titel,
    description: latest.beschreibung,
    category: latest.kategorie,
    tags: latest.tags,
    moderatorNote: latest.moderationsnotiz,
    configVersion: latest.konfigurations_version,
    config: latest.konfiguration,
    mediaCount: getStoryMediaCount(latest.konfiguration),
    revisionCreatorName: latest.created_by?.name ?? latest.created_by?.email ?? null,
    revisionCreatedAt: latest.created_at,
    usageCount: story.revisionen.reduce(
      (sum, revision) => sum + revision._count.quiz_ablauf_elemente,
      0,
    ),
    quizUsages: [...new Map(
      story.revisionen.flatMap((revision) => revision.quiz_ablauf_elemente)
        .map(({ quiz }) => [quiz.quiz_id, {
          quizId: quiz.quiz_id,
          title: quiz.titel ?? `Quiz ${quiz.quiz_id}`,
          date: quiz.quiz_datum?.toISOString().slice(0, 10) ?? null,
          archived: quiz.ist_archiviert,
        }] as const),
    ).values()],
    questionLinkCount: story._count.fragen_verknuepfungen,
    revisionCount: story.revisionen.length,
    access: toAccessContext(story),
  };
}

async function queryStoryElements(where: Prisma.story_elementeWhereInput) {
  return prisma.story_elemente.findMany({
    where,
    include: storyElementInclude,
    orderBy: [{ updated_at: "desc" }, { story_element_id: "desc" }],
  });
}

export async function listStoryElements(
  actor: AuthorizationActor,
  filters: StoryElementFilters = {},
) {
  const status = isStoryElementStatus(filters.status) ? filters.status : null;
  const type = isStoryElementType(filters.type) ? filters.type : null;
  const scope = isStoryElementScope(filters.scope) ? filters.scope : null;
  const eventSeriesId = Number(filters.eventSeriesId);
  const query = filters.query?.trim();
  const stories = await queryStoryElements({
    AND: [
      buildVisibilityWhere(actor),
      status ? { status } : {},
      scope ? { geltungsbereich: scope } : {},
      Number.isSafeInteger(eventSeriesId) && eventSeriesId > 0
        ? {
            OR: [
              { eventreihe_id: eventSeriesId },
              { quiz: { eventreihe_id: eventSeriesId } },
            ],
          }
        : {},
      filters.creator === "ME" ? { created_by_user_id: actor.userId } : {},
      type ? { revisionen: { some: { typ: type } } } : {},
    ],
  });
  const normalizedQuery = query?.toLocaleLowerCase("de-DE");
  return stories
    .map(mapStoryElement)
    .filter((story): story is NonNullable<typeof story> =>
      story !== null && canViewStoryElement(actor, story.access) &&
      (!type || story.type === type) &&
      (!normalizedQuery || `${story.stableKey} ${story.id} ${story.title} ${story.description ?? ""} ${JSON.stringify(story.config)}`.toLocaleLowerCase("de-DE").includes(normalizedQuery)) &&
      (filters.mediaState !== "WITH" || story.mediaCount > 0) &&
      (filters.mediaState !== "WITHOUT" || story.mediaCount === 0) &&
      (filters.usageState !== "USED" || story.usageCount + story.questionLinkCount > 0) &&
      (filters.usageState !== "UNUSED" || story.usageCount + story.questionLinkCount === 0),
    );
}

export async function listStoryElementPage(
  actor: AuthorizationActor,
  filters: StoryElementFilters,
  page: number,
  pageSize: number,
) {
  const all = await listStoryElements(actor, filters);
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  return {
    stories: all.slice(offset, offset + pageSize),
    total: all.length,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
  };
}

export async function loadStoryElement(
  actor: AuthorizationActor,
  storyElementId: number,
) {
  const story = await prisma.story_elemente.findUnique({
    where: { story_element_id: storyElementId },
    include: storyElementInclude,
  });
  const mapped = story ? mapStoryElement(story) : null;
  return mapped && canViewStoryElement(actor, mapped.access) ? mapped : null;
}

export async function getStoryElementEditorOptions(actor: AuthorizationActor) {
  const eventSeriesIds = getActorEventSeriesIds(actor);
  const eventSeries = await prisma.eventreihen.findMany({
    where: {
      ist_archiviert: false,
      ...(isAdministrator(actor) ? {} : { eventreihe_id: { in: eventSeriesIds } }),
    },
    select: { eventreihe_id: true, name: true },
    orderBy: { name: "asc" },
  });
  const quizzes = await prisma.quiz.findMany({
    where: {
      ist_archiviert: false,
      eventreihe_id: { in: eventSeries.map((series) => series.eventreihe_id) },
    },
    select: {
      quiz_id: true,
      titel: true,
      quiz_datum: true,
      eventreihe_id: true,
      eventreihe: { select: { name: true } },
      quiz_abschnitte: {
        where: { abschnitt_typ: { in: ["fragenblock", "fragenrunde"] } },
        select: { quiz_abschnitt_id: true, titel: true, sortierung: true },
        orderBy: { sortierung: "asc" },
      },
    },
    orderBy: [{ quiz_datum: "desc" }, { quiz_id: "desc" }],
  });
  return { eventSeries, quizzes, canUseGlobalScope: isAdministrator(actor) };
}

export async function resolveStoryElementScopeSelection(
  actor: AuthorizationActor,
  input: {
    scope: StoryElementScopeValue;
    eventSeriesId: number | null;
    quizId: number | null;
  },
) {
  const [eventSeries, quiz] = await Promise.all([
    input.eventSeriesId === null
      ? null
      : prisma.eventreihen.findFirst({
          where: { eventreihe_id: input.eventSeriesId, ist_archiviert: false },
          select: { eventreihe_id: true },
        }),
    input.quizId === null
      ? null
      : prisma.quiz.findFirst({
          where: { quiz_id: input.quizId, ist_archiviert: false },
          select: { quiz_id: true, eventreihe_id: true },
        }),
  ]);
  const allowed = canUseStoryElementScope(actor, {
    scope: input.scope,
    eventSeriesId: eventSeries?.eventreihe_id ?? null,
    quizEventSeriesId: quiz?.eventreihe_id ?? null,
  });
  if (!allowed) throw new Error("Der gewählte Geltungsbereich ist nicht erlaubt.");
  return { eventSeries, quiz };
}

export async function listSelectableStoryElementsForQuiz(
  actor: AuthorizationActor,
  quizId: number,
) {
  const quiz = await prisma.quiz.findUnique({
    where: { quiz_id: quizId },
    select: { quiz_id: true, eventreihe_id: true },
  });
  if (!quiz) return [];
  const [active, drafts] = await Promise.all([
    listStoryElements(actor, { status: "ACTIVE" }),
    listStoryElements(actor, { status: "DRAFT", creator: "ME" }),
  ]);
  return [...active, ...drafts].filter((story, index, all) =>
    all.findIndex((candidate) => candidate.id === story.id) === index &&
    canAttachStoryElementToQuiz(actor, story.access, {
      quizId: quiz.quiz_id,
      eventSeriesId: quiz.eventreihe_id,
    }),
  );
}

export async function listSelectableStoryElementsForQuestionCreation(
  actor: AuthorizationActor,
) {
  const [active, drafts] = await Promise.all([
    listStoryElements(actor, { status: "ACTIVE" }),
    listStoryElements(actor, { status: "DRAFT", creator: "ME" }),
  ]);
  return [...active, ...drafts].filter((story, index, all) =>
    story.scope !== "QUIZ" &&
    all.findIndex((candidate) => candidate.id === story.id) === index,
  );
}

export type StoryElementRecord = NonNullable<
  Awaited<ReturnType<typeof loadStoryElement>>
>;
