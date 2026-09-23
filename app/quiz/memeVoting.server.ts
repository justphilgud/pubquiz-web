import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { parseMemeCaptionPayload } from "@/app/quiz/memeCaption";
import {
  countEligibleMemeVoters,
  createInitialMemePresentationState,
  getMemeOverviewPageCount,
  planMemeVoteWrite,
  teamCanVoteForCandidate,
  transitionMemePresentation,
  type MemePresentationCandidate,
  type MemePresentationTransition,
} from "@/app/quiz/memeVoting";

type DbClient = Prisma.TransactionClient;

const selectionInclude = {
  quiz_frage: {
    select: {
      quiz_fragen_id: true,
      fragen: {
        select: {
          medien: {
            where: { slot_key: "question_image" },
            orderBy: { sortierung: "asc" as const },
            take: 1,
            select: { datei: true },
          },
        },
      },
    },
  },
  candidates: {
    where: { review_status: "APPROVED" as const },
    orderBy: { position: "asc" as const },
    include: {
      submission: {
        include: {
          quiz_team_session: { select: { team_id: true } },
        },
      },
    },
  },
  presentation: true,
};

type SelectionRecord = Prisma.meme_moderation_selectionsGetPayload<{
  include: typeof selectionInclude;
}>;

export type MemePresentationSnapshot = {
  phase: "READY" | "PRESENTING" | "OVERVIEW" | "VOTING_OPEN" | "VOTING_CLOSED";
  presentationId: number | null;
  selectionId: number;
  quizFragenId: number;
  revision: number;
  imageUrl: string | null;
  candidates: MemePresentationCandidate[];
  activeCandidateNumber: number | null;
  overviewPage: number;
  overviewPageCount: number;
  votingOpenedAt: string | null;
  votingClosedAt: string | null;
  progress: { votesCast: number; eligibleTeams: number; totalTeams: number } | null;
  team: {
    ownCandidateIds: number[];
    canVote: boolean;
    vote: { candidateId: number; revision: number; updatedAt: string } | null;
  } | null;
};

function mediaUrl(file: string | undefined) {
  if (!file) return null;
  if (/^https?:\/\//.test(file) || file.startsWith("/")) return file;
  return `/medien/${file}`;
}

function candidatesFromSelection(selection: SelectionRecord) {
  return selection.candidates.map((candidate) => {
    const payload = parseMemeCaptionPayload(candidate.submission.payload);
    if (!payload) throw new Error("Ein freigegebener Meme-Kandidat ist ungültig.");
    return {
      candidateId: candidate.meme_moderation_candidate_id,
      number: candidate.position,
      topText: payload.topText,
      bottomText: payload.bottomText,
      ownerTeamId: candidate.submission.quiz_team_session.team_id,
    };
  });
}

async function findSelection(input: {
  quizId: number;
  quizFragenId?: number;
}) {
  if (input.quizFragenId !== undefined) {
    return prisma.meme_moderation_selections.findFirst({
      where: {
        quiz_fragen_id: input.quizFragenId,
        state: "COMPLETED",
        interaction_run: { quiz_id: input.quizId },
      },
      orderBy: { interaction_run_id: "desc" },
      include: selectionInclude,
    });
  }
  const presentation = await prisma.meme_presentations.findFirst({
    where: { quiz_id: input.quizId },
    orderBy: { updated_at: "desc" },
    select: { meme_moderation_selection_id: true },
  });
  if (!presentation) return null;
  return prisma.meme_moderation_selections.findUnique({
    where: {
      meme_moderation_selection_id: presentation.meme_moderation_selection_id,
    },
    include: selectionInclude,
  });
}

export async function getMemePresentationSnapshot(input: {
  quizId: number;
  quizFragenId?: number;
  quizTeamSessionId?: number | null;
  includeModeration?: boolean;
}): Promise<MemePresentationSnapshot | null> {
  const selection = await findSelection(input);
  if (!selection || selection.state !== "COMPLETED") return null;
  const internalCandidates = candidatesFromSelection(selection);
  if (internalCandidates.length === 0) return null;
  const presentation = selection.presentation;
  const isTeam = input.quizTeamSessionId !== undefined && input.quizTeamSessionId !== null;
  let voterTeamId: number | null = null;
  let ownVote: { meme_moderation_candidate_id: number; revision: number; updated_at: Date } | null = null;
  if (isTeam) {
    const session = await prisma.quiz_team_sessions.findFirst({
      where: {
        quiz_team_session_id: input.quizTeamSessionId!,
        quiz_id: input.quizId,
      },
      select: { team_id: true },
    });
    if (!session) return null;
    voterTeamId = session.team_id;
    if (presentation) {
      ownVote = await prisma.meme_votes.findUnique({
        where: {
          meme_presentation_id_quiz_team_session_id: {
            meme_presentation_id: presentation.meme_presentation_id,
            quiz_team_session_id: input.quizTeamSessionId!,
          },
        },
        select: {
          meme_moderation_candidate_id: true,
          revision: true,
          updated_at: true,
        },
      });
    }
  }

  let progress: MemePresentationSnapshot["progress"] = null;
  if (presentation && input.includeModeration) {
    const [sessions, votesCast] = await Promise.all([
      prisma.quiz_team_sessions.findMany({
        where: { quiz_id: input.quizId },
        select: { team_id: true },
      }),
      prisma.meme_votes.count({
        where: { meme_presentation_id: presentation.meme_presentation_id },
      }),
    ]);
    progress = {
      votesCast,
      eligibleTeams: countEligibleMemeVoters(
        sessions.map((session) => session.team_id),
        internalCandidates.map((candidate) => candidate.ownerTeamId),
      ),
      totalTeams: sessions.length,
    };
  }

  const phase = presentation?.state ?? "READY";
  const exposeCandidates = !isTeam || phase === "VOTING_OPEN" || phase === "VOTING_CLOSED";
  const ownCandidateIds = voterTeamId === null
    ? []
    : internalCandidates
        .filter((candidate) => candidate.ownerTeamId === voterTeamId)
        .map((candidate) => candidate.candidateId);
  const canVote = voterTeamId !== null &&
    phase === "VOTING_OPEN" &&
    internalCandidates.some((candidate) =>
      teamCanVoteForCandidate({
        votingOpen: true,
        voterTeamId: voterTeamId!,
        ownerTeamId: candidate.ownerTeamId,
      }),
    );

  return {
    phase,
    presentationId: presentation?.meme_presentation_id ?? null,
    selectionId: selection.meme_moderation_selection_id,
    quizFragenId: selection.quiz_fragen_id,
    revision: presentation?.revision ?? 0,
    imageUrl: mediaUrl(selection.quiz_frage.fragen.medien[0]?.datei),
    candidates: exposeCandidates
      ? internalCandidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          number: candidate.number,
          topText: candidate.topText,
          bottomText: candidate.bottomText,
        }))
      : [],
    activeCandidateNumber: presentation?.active_candidate_position ?? null,
    overviewPage: presentation?.overview_page ?? 0,
    overviewPageCount: getMemeOverviewPageCount(internalCandidates.length),
    votingOpenedAt: presentation?.voting_opened_at?.toISOString() ?? null,
    votingClosedAt: presentation?.voting_closed_at?.toISOString() ?? null,
    progress,
    team: isTeam
      ? {
          ownCandidateIds,
          canVote,
          vote: ownVote
            ? {
                candidateId: ownVote.meme_moderation_candidate_id,
                revision: ownVote.revision,
                updatedAt: ownVote.updated_at.toISOString(),
              }
            : null,
        }
      : null,
  };
}

async function lockSelection(db: DbClient, selectionId: number) {
  await db.$queryRaw`
    SELECT "meme_moderation_selection_id"
    FROM "pubquiz"."meme_moderation_selections"
    WHERE "meme_moderation_selection_id" = ${selectionId}
    FOR UPDATE
  `;
}

async function lockPresentation(db: DbClient, presentationId: number) {
  await db.$queryRaw`
    SELECT "meme_presentation_id"
    FROM "pubquiz"."meme_presentations"
    WHERE "meme_presentation_id" = ${presentationId}
    FOR UPDATE
  `;
}

export async function startMemePresentation(input: {
  quizId: number;
  quizFragenId: number;
  selectionId: number;
  actorUserId: number;
}) {
  return prisma.$transaction(async (tx) => {
    await lockSelection(tx, input.selectionId);
    const selection = await tx.meme_moderation_selections.findFirst({
      where: {
        meme_moderation_selection_id: input.selectionId,
        quiz_fragen_id: input.quizFragenId,
        state: "COMPLETED",
        interaction_run: { quiz_id: input.quizId },
      },
      include: {
        candidates: {
          where: { review_status: "APPROVED" },
          orderBy: { position: "asc" },
          select: { position: true },
        },
        presentation: { select: { meme_presentation_id: true } },
      },
    });
    if (!selection) throw new Error("Der abgeschlossene Meme-Review wurde nicht gefunden.");
    if (selection.presentation) {
      return { success: true as const, presentationId: selection.presentation.meme_presentation_id };
    }
    const initial = createInitialMemePresentationState(
      selection.candidates.map((candidate) => candidate.position),
    );
    const created = await tx.meme_presentations.create({
      data: {
        meme_moderation_selection_id: selection.meme_moderation_selection_id,
        quiz_id: input.quizId,
        quiz_fragen_id: input.quizFragenId,
        state: initial.state,
        active_candidate_position: initial.activeCandidatePosition,
        overview_page: initial.overviewPage,
        started_by_user_id: input.actorUserId,
      },
      select: { meme_presentation_id: true },
    });
    return { success: true as const, presentationId: created.meme_presentation_id };
  });
}

export async function transitionMemePresentationState(input: {
  quizId: number;
  quizFragenId: number;
  presentationId: number;
  expectedRevision: number;
  transition: MemePresentationTransition;
  actorUserId: number;
}) {
  return prisma.$transaction(async (tx) => {
    await lockPresentation(tx, input.presentationId);
    const presentation = await tx.meme_presentations.findFirst({
      where: {
        meme_presentation_id: input.presentationId,
        quiz_id: input.quizId,
        quiz_fragen_id: input.quizFragenId,
      },
      include: {
        selection: {
          include: {
            candidates: {
              where: { review_status: "APPROVED" },
              orderBy: { position: "asc" },
              select: { position: true },
            },
          },
        },
      },
    });
    if (!presentation) throw new Error("Die Meme-Präsentation gehört nicht zu diesem Quiz.");
    if (presentation.revision !== input.expectedRevision) {
      return { success: false as const, reason: "REVISION_CONFLICT" as const };
    }
    const next = transitionMemePresentation(
      {
        state: presentation.state,
        activeCandidatePosition: presentation.active_candidate_position,
        overviewPage: presentation.overview_page,
      },
      presentation.selection.candidates.map((candidate) => candidate.position),
      input.transition,
    );
    if (!next) return { success: false as const, reason: "INVALID_TRANSITION" as const };
    const now = new Date();
    await tx.meme_presentations.update({
      where: { meme_presentation_id: input.presentationId },
      data: {
        state: next.state,
        active_candidate_position: next.activeCandidatePosition,
        overview_page: next.overviewPage,
        revision: { increment: 1 },
        ...(input.transition === "OPEN_VOTING" ? { voting_opened_at: now } : {}),
        ...(input.transition === "CLOSE_VOTING"
          ? { voting_closed_at: now, voting_closed_by_user_id: input.actorUserId }
          : {}),
      },
    });
    return { success: true as const };
  });
}

export async function submitMemeVote(input: {
  quizId: number;
  presentationId: number;
  candidateId: number;
  quizTeamSessionId: number;
  expectedVoteRevision: number | null;
}) {
  return prisma.$transaction(async (tx) => {
    await lockPresentation(tx, input.presentationId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${input.presentationId}, ${input.quizTeamSessionId})`;
    const presentation = await tx.meme_presentations.findFirst({
      where: { meme_presentation_id: input.presentationId, quiz_id: input.quizId },
      include: {
        selection: {
          include: {
            candidates: {
              where: { review_status: "APPROVED" },
              include: {
                submission: {
                  include: { quiz_team_session: { select: { team_id: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!presentation) throw new Error("Das Meme-Voting gehört nicht zu diesem Quiz.");
    const voter = await tx.quiz_team_sessions.findFirst({
      where: {
        quiz_team_session_id: input.quizTeamSessionId,
        quiz_id: input.quizId,
      },
      select: { team_id: true },
    });
    if (!voter) throw new Error("Die Team-Sitzung gehört nicht zu diesem Quiz.");
    const candidate = presentation.selection.candidates.find(
      (entry) => entry.meme_moderation_candidate_id === input.candidateId,
    );
    if (!candidate) return { success: false as const, reason: "INVALID_CANDIDATE" as const };
    const existing = await tx.meme_votes.findUnique({
      where: {
        meme_presentation_id_quiz_team_session_id: {
          meme_presentation_id: input.presentationId,
          quiz_team_session_id: input.quizTeamSessionId,
        },
      },
    });
    const writePlan = planMemeVoteWrite({
      presentationState: presentation.state,
      voterTeamId: voter.team_id,
      ownerTeamId: candidate.submission.quiz_team_session.team_id,
      expectedRevision: input.expectedVoteRevision,
      currentRevision: existing?.revision ?? null,
    });
    if (!writePlan.ok && writePlan.reason === "REVISION_CONFLICT") {
      return {
        success: false as const,
        reason: writePlan.reason,
        vote: existing
          ? {
              candidateId: existing.meme_moderation_candidate_id,
              revision: existing.revision,
              updatedAt: existing.updated_at.toISOString(),
            }
          : null,
      };
    }
    if (!writePlan.ok) return { success: false as const, reason: writePlan.reason };
    const vote = writePlan.operation === "UPDATE" && existing
      ? await tx.meme_votes.update({
          where: { meme_vote_id: existing.meme_vote_id },
          data: {
            meme_moderation_candidate_id: input.candidateId,
            revision: { increment: 1 },
          },
        })
      : await tx.meme_votes.create({
          data: {
            meme_presentation_id: input.presentationId,
            quiz_team_session_id: input.quizTeamSessionId,
            meme_moderation_candidate_id: input.candidateId,
          },
        });
    return {
      success: true as const,
      vote: {
        candidateId: vote.meme_moderation_candidate_id,
        revision: vote.revision,
        updatedAt: vote.updated_at.toISOString(),
      },
    };
  });
}

export async function readClosedMemeVotingForAp4(input: {
  quizId: number;
  quizFragenId: number;
}) {
  const presentation = await prisma.meme_presentations.findFirst({
    where: {
      quiz_id: input.quizId,
      quiz_fragen_id: input.quizFragenId,
      state: "VOTING_CLOSED",
    },
    orderBy: { created_at: "desc" },
    include: {
      selection: {
        include: {
          candidates: {
            where: { review_status: "APPROVED" },
            orderBy: { position: "asc" },
            include: {
              submission: {
                include: { quiz_team_session: { select: { team_id: true } } },
              },
            },
          },
        },
      },
      votes: {
        orderBy: { quiz_team_session_id: "asc" },
        include: { quiz_team_session: { select: { team_id: true } } },
      },
    },
  });
  if (!presentation) return null;
  return {
    presentationId: presentation.meme_presentation_id,
    quizFragenId: presentation.quiz_fragen_id,
    state: "VOTING_CLOSED" as const,
    candidates: presentation.selection.candidates.map((candidate) => ({
      candidateId: candidate.meme_moderation_candidate_id,
      submissionId: candidate.team_answer_submission_id,
      number: candidate.position,
      ownerTeamId: candidate.submission.quiz_team_session.team_id,
    })),
    votes: presentation.votes.map((vote) => ({
      voterTeamId: vote.quiz_team_session.team_id,
      candidateId: vote.meme_moderation_candidate_id,
      revision: vote.revision,
      updatedAt: vote.updated_at.toISOString(),
    })),
    votingClosedAt: presentation.voting_closed_at?.toISOString() ?? null,
  };
}
