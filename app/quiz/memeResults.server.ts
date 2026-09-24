import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { CURRENT_QUIZ_ANSWER_EVALUATION_VERSION } from "@/app/quiz/evaluation/evaluationCompleteness";
import { memeCaptionPayloadValues, parseMemeCaptionPayload } from "@/app/quiz/memeCaption";
import { resolveMemeCaptionLayout, type ResolvedMemeCaptionLayout } from "@/app/quiz/memeCaptionZones";
import { readInteractionSnapshot } from "@/app/quiz/interaction/interactionStoredAnswer";
import {
  calculateMemeResult,
  getMemeResultPageCount,
} from "@/app/quiz/memeResults";
import { mapTeamProfile, type TeamAvatarCode } from "@/app/teams/teamProfile";

export type MemeResultSnapshotEntry = {
  candidateId: number;
  number: number;
  topText: string;
  bottomText: string;
  captions?: Record<string, string>;
  layout?: ResolvedMemeCaptionLayout;
  teamName: string;
  avatarCode: TeamAvatarCode;
  photoUrl: string | null;
  voteCount: number;
  share: number;
  isWinner: boolean;
  awardedPoints: number;
};

export type MemeResultSnapshot = {
  presentationId: number;
  quizFragenId: number;
  finalizedAt: string;
  revision: number;
  totalVotes: number;
  maximumVotes: number;
  pageCount: number;
  entries: MemeResultSnapshotEntry[];
};

async function lockQuizAndPresentation(
  tx: Prisma.TransactionClient,
  quizId: number,
  presentationId: number,
) {
  await tx.$queryRaw`
    SELECT "quiz_id"
    FROM "pubquiz"."quiz"
    WHERE "quiz_id" = ${quizId}
    FOR UPDATE
  `;
  await tx.$queryRaw`
    SELECT "meme_presentation_id"
    FROM "pubquiz"."meme_presentations"
    WHERE "meme_presentation_id" = ${presentationId}
    FOR UPDATE
  `;
}

export async function finalizeMemeResult(input: {
  quizId: number;
  quizFragenId: number;
  presentationId: number;
  actorUserId: number;
}) {
  return prisma.$transaction(async (tx) => {
    await lockQuizAndPresentation(tx, input.quizId, input.presentationId);
    const presentation = await tx.meme_presentations.findFirst({
      where: {
        meme_presentation_id: input.presentationId,
        quiz_id: input.quizId,
        quiz_fragen_id: input.quizFragenId,
        state: "VOTING_CLOSED",
      },
      include: {
        selection: {
          include: {
            candidates: {
              where: { review_status: "APPROVED" },
              orderBy: { position: "asc" },
              include: {
                submission: {
                  select: {
                    team_antwort_id: true,
                    quiz_team_session: { select: { team_id: true } },
                  },
                },
              },
            },
          },
        },
        votes: { select: { meme_moderation_candidate_id: true } },
      },
    });
    if (!presentation) {
      throw new Error("Das Meme-Voting ist noch nicht final geschlossen.");
    }
    if (presentation.result_finalized_at) {
      return { success: true as const, alreadyFinalized: true as const };
    }

    const calculated = calculateMemeResult({
      candidates: presentation.selection.candidates.map((candidate) => ({
        candidateId: candidate.meme_moderation_candidate_id,
        number: candidate.position,
        ownerTeamId: candidate.submission.quiz_team_session.team_id,
      })),
      voteCandidateIds: presentation.votes.map(
        (vote) => vote.meme_moderation_candidate_id,
      ),
    });
    const now = new Date();
    await tx.meme_result_entries.createMany({
      data: calculated.entries.map((entry) => ({
        meme_presentation_id: presentation.meme_presentation_id,
        meme_moderation_candidate_id: entry.candidateId,
        vote_count: entry.voteCount,
        is_winner: entry.isWinner,
        awarded_points: new Prisma.Decimal(entry.awardedPoints),
      })),
    });

    const candidateById = new Map(
      presentation.selection.candidates.map((candidate) => [
        candidate.meme_moderation_candidate_id,
        candidate,
      ]),
    );
    for (const entry of calculated.entries) {
      const candidate = candidateById.get(entry.candidateId);
      if (!candidate) throw new Error("Der gespeicherte Meme-Kandidat fehlt.");
      const points = new Prisma.Decimal(entry.awardedPoints);
      const updated = await tx.team_antworten.updateMany({
        where: {
          team_antwort_id: candidate.submission.team_antwort_id,
          quiz_id: input.quizId,
          quiz_fragen_id: input.quizFragenId,
        },
        data: {
          auto_basis_punkte: points,
          auto_endpunkte: points,
          vergebene_punkte: points,
          bewertungsstatus: entry.isWinner ? "CORRECT" : "WRONG",
          bewertungsquelle: "AUTO",
          bewertungsdetails: {
            strategy: "MEME_VOTING",
            presentationId: presentation.meme_presentation_id,
            candidateId: entry.candidateId,
            candidateNumber: entry.number,
            voteCount: entry.voteCount,
            totalVotes: calculated.totalVotes,
            isWinner: entry.isWinner,
          },
          bewertungs_version: CURRENT_QUIZ_ANSWER_EVALUATION_VERSION,
          bewertung_final: true,
          ist_manuell_richtig: false,
          ist_manuell_falsch: false,
          manuelle_punkte: null,
          bewertet_am: now,
          bewertet_von_user_id: null,
        },
      });
      if (updated.count !== 1) {
        throw new Error("Die zentrale Teambewertung des Meme-Kandidaten fehlt.");
      }
    }

    await tx.quiz_fragen.update({
      where: { quiz_fragen_id: input.quizFragenId },
      data: {
        punkte_basis: new Prisma.Decimal(1),
        richtigeantworten: calculated.winnerCandidateIds.length,
        falscheantworten:
          presentation.selection.candidates.length - calculated.winnerCandidateIds.length,
      },
    });
    await tx.meme_presentations.update({
      where: { meme_presentation_id: presentation.meme_presentation_id },
      data: {
        result_finalized_at: now,
        result_finalized_by_user_id: input.actorUserId,
        result_revision: { increment: 1 },
        revision: { increment: 1 },
      },
    });
    return { success: true as const, alreadyFinalized: false as const };
  }, { timeout: 30_000 });
}

export async function readMemeResultSnapshot(input: {
  quizId: number;
  quizFragenId: number;
  presentationId: number;
}): Promise<MemeResultSnapshot | null> {
  const presentation = await prisma.meme_presentations.findFirst({
    where: {
      meme_presentation_id: input.presentationId,
      quiz_id: input.quizId,
      quiz_fragen_id: input.quizFragenId,
      state: "VOTING_CLOSED",
      result_finalized_at: { not: null },
    },
    select: {
      meme_presentation_id: true,
      quiz_fragen_id: true,
      result_finalized_at: true,
      result_revision: true,
      selection: { select: { interaction_run: { select: { config_snapshot: true } } } },
      result_entries: {
        orderBy: { candidate: { position: "asc" } },
        select: {
          vote_count: true,
          is_winner: true,
          awarded_points: true,
          candidate: {
            select: {
              meme_moderation_candidate_id: true,
              position: true,
              submission: {
                select: {
                  payload: true,
                  quiz_team_session: {
                    select: {
                      teamname: true,
                      team: {
                        select: {
                          team_id: true,
                          avatar_code: true,
                          foto_url: true,
                          foto_upload_gesperrt: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!presentation?.result_finalized_at) return null;
  const totalVotes = presentation.result_entries.reduce(
    (sum, entry) => sum + entry.vote_count,
    0,
  );
  const maximumVotes = Math.max(
    0,
    ...presentation.result_entries.map((entry) => entry.vote_count),
  );
  const interaction = readInteractionSnapshot(
    presentation.selection.interaction_run.config_snapshot,
  );
  const layout = interaction.type === "MEME_CAPTION"
    ? resolveMemeCaptionLayout(interaction.layout)
    : resolveMemeCaptionLayout(null);
  const entries = presentation.result_entries.map((entry) => {
    const payload = parseMemeCaptionPayload(entry.candidate.submission.payload);
    if (!payload) throw new Error("Ein finalisierter Meme-Kandidat ist ungültig.");
    const captions = memeCaptionPayloadValues(payload).captions;
    const session = entry.candidate.submission.quiz_team_session;
    const profile = mapTeamProfile(session.team);
    return {
      candidateId: entry.candidate.meme_moderation_candidate_id,
      number: entry.candidate.position,
      topText: captions.top ?? "",
      bottomText: captions.bottom ?? "",
      captions,
      layout,
      teamName: session.teamname,
      avatarCode: profile.avatarCode,
      photoUrl: profile.photoUrl,
      voteCount: entry.vote_count,
      share: totalVotes === 0 ? 0 : (entry.vote_count / totalVotes) * 100,
      isWinner: entry.is_winner,
      awardedPoints: Number(entry.awarded_points),
    } satisfies MemeResultSnapshotEntry;
  });
  return {
    presentationId: presentation.meme_presentation_id,
    quizFragenId: presentation.quiz_fragen_id,
    finalizedAt: presentation.result_finalized_at.toISOString(),
    revision: presentation.result_revision,
    totalVotes,
    maximumVotes,
    pageCount: getMemeResultPageCount(entries.length),
    entries,
  };
}
