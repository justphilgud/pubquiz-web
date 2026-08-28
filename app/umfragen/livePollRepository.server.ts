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
  canEditStoryElement,
  canViewStoryElement,
} from "@/app/story-elemente/storyElementPolicy";
import { isLivePollType, parseLivePollOptions, type LivePollScope, type LivePollStatus } from "./livePoll";

const include = {
  eventreihe: { select: { eventreihe_id: true, name: true } },
  quiz: { select: { quiz_id: true, titel: true, eventreihe_id: true, eventreihe: { select: { name: true } } } },
  created_by: { select: { id: true, name: true, email: true } },
  revisionen: {
    orderBy: { revisionsnummer: "desc" as const },
    include: { _count: { select: { quiz_ablauf_elemente: true } } },
  },
} satisfies Prisma.live_pollsInclude;

type PollWithRelations = Prisma.live_pollsGetPayload<{ include: typeof include }>;

function access(poll: PollWithRelations) {
  return {
    scope: poll.geltungsbereich,
    eventSeriesId: poll.eventreihe_id,
    quizId: poll.quiz_id,
    quizEventSeriesId: poll.quiz?.eventreihe_id ?? null,
    createdByUserId: poll.created_by_user_id,
    status: poll.status,
  };
}

function mapPoll(poll: PollWithRelations) {
  const revision = poll.revisionen[0];
  if (!revision || !isLivePollType(revision.typ)) return null;
  const options = parseLivePollOptions(revision.optionen) ?? [];
  return {
    id: poll.live_poll_id,
    stableKey: poll.stable_key,
    status: poll.status,
    scope: poll.geltungsbereich,
    eventSeriesId: poll.eventreihe_id,
    eventSeriesName: poll.eventreihe?.name ?? poll.quiz?.eventreihe.name ?? null,
    quizId: poll.quiz_id,
    quizTitle: poll.quiz?.titel ?? null,
    createdByUserId: poll.created_by_user_id,
    creatorName: poll.created_by?.name ?? poll.created_by?.email ?? null,
    sourcePollId: poll.source_live_poll_id,
    archivedAt: poll.archived_at,
    createdAt: poll.created_at,
    updatedAt: poll.updated_at,
    revisionId: revision.live_poll_revision_id,
    revisionNumber: revision.revisionsnummer,
    type: revision.typ,
    prompt: revision.prompt,
    publicationMode: revision.publication_mode,
    options,
    moderatorNote: revision.moderationsnotiz,
    usageCount: poll.revisionen.reduce((sum, item) => sum + item._count.quiz_ablauf_elemente, 0),
    access: access(poll),
  };
}

function visibility(actor: AuthorizationActor): Prisma.live_pollsWhereInput {
  if (isAdministrator(actor)) return {};
  const ids = getActorEventSeriesIds(actor);
  return {
    OR: [
      { geltungsbereich: "GLOBAL" },
      { geltungsbereich: "EVENT_SERIES", eventreihe_id: { in: ids } },
      { geltungsbereich: "QUIZ", quiz: { eventreihe_id: { in: ids } } },
    ],
  };
}

export async function listLivePolls(actor: AuthorizationActor) {
  const polls = await prisma.live_polls.findMany({
    where: visibility(actor),
    include,
    orderBy: [{ updated_at: "desc" }, { live_poll_id: "desc" }],
  });
  return polls.map(mapPoll).filter((poll): poll is NonNullable<typeof poll> => Boolean(poll && canViewStoryElement(actor, poll.access)));
}

export async function loadLivePoll(actor: AuthorizationActor, pollId: number) {
  const poll = await prisma.live_polls.findUnique({ where: { live_poll_id: pollId }, include });
  const mapped = poll ? mapPoll(poll) : null;
  return mapped && canViewStoryElement(actor, mapped.access) ? mapped : null;
}

export async function getLivePollEditorOptions(actor: AuthorizationActor) {
  const ids = getActorEventSeriesIds(actor);
  const eventSeries = await prisma.eventreihen.findMany({
    where: { ist_archiviert: false, ...(isAdministrator(actor) ? {} : { eventreihe_id: { in: ids } }) },
    select: { eventreihe_id: true, name: true },
    orderBy: { name: "asc" },
  });
  const quizzes = await prisma.quiz.findMany({
    where: { ist_archiviert: false, eventreihe_id: { in: eventSeries.map((item) => item.eventreihe_id) } },
    select: {
      quiz_id: true,
      titel: true,
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

export async function resolveLivePollScope(actor: AuthorizationActor, input: { scope: LivePollScope; eventSeriesId: number | null; quizId: number | null }) {
  const quiz = input.quizId === null ? null : await prisma.quiz.findFirst({ where: { quiz_id: input.quizId, ist_archiviert: false }, select: { quiz_id: true, eventreihe_id: true } });
  const eventSeries = input.eventSeriesId === null ? null : await prisma.eventreihen.findFirst({ where: { eventreihe_id: input.eventSeriesId, ist_archiviert: false }, select: { eventreihe_id: true } });
  const allowed = canEditStoryElement(actor, {
    scope: input.scope,
    eventSeriesId: eventSeries?.eventreihe_id ?? null,
    quizId: quiz?.quiz_id ?? null,
    quizEventSeriesId: quiz?.eventreihe_id ?? null,
    createdByUserId: actor.userId,
    status: "DRAFT",
  });
  if (!allowed) throw new Error("Der gewählte Geltungsbereich ist nicht erlaubt.");
  return { quiz, eventSeries };
}

export function canAttachLivePoll(actor: AuthorizationActor, poll: { status: LivePollStatus; scope: LivePollScope; eventSeriesId: number | null; quizId: number | null; createdByUserId: number | null }, quiz: { quizId: number; eventSeriesId: number }) {
  return canAttachStoryElementToQuiz(actor, {
    scope: poll.scope,
    eventSeriesId: poll.eventSeriesId,
    quizId: poll.quizId,
    quizEventSeriesId: poll.scope === "QUIZ" ? quiz.eventSeriesId : null,
    createdByUserId: poll.createdByUserId,
    status: poll.status,
  }, quiz);
}

export type LivePollRecord = NonNullable<Awaited<ReturnType<typeof loadLivePoll>>>;
