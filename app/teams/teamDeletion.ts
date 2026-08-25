import type { Prisma } from "@/app/generated/prisma/client";

export type TeamDeletionResult =
  | {
      status: "deleted";
      participationCount: number;
      affectedQuizIds: number[];
    }
  | {
      status: "blocked" | "confirmation_mismatch" | "not_found";
      message: string;
    };

export async function deleteTeamInTransaction(
  transaction: Prisma.TransactionClient,
  input: {
    teamId: number;
    force: boolean;
    confirmation: string;
  },
): Promise<TeamDeletionResult> {
  const team = await transaction.teams.findUnique({
    where: { team_id: input.teamId },
    select: {
      teamname: true,
      quiz_teams: { select: { quiz_id: true } },
      quiz_team_sessions: {
        select: {
          quiz_team_session_id: true,
          quiz_id: true,
          team_antworten: { select: { team_antwort_id: true } },
        },
      },
    },
  });
  if (!team) {
    return {
      status: "not_found",
      message: "Team nicht gefunden oder Zugriff nicht erlaubt.",
    };
  }

  const hasHistory = team.quiz_team_sessions.length > 0 || team.quiz_teams.length > 0;
  if (hasHistory && !input.force) {
    return {
      status: "blocked",
      message:
        "Dieses Team hat Quiz-Historie. Bitte archivieren oder als Administrator mit Force Delete endgültig löschen.",
    };
  }
  if (input.force && input.confirmation !== team.teamname) {
    return {
      status: "confirmation_mismatch",
      message: "Bitte den Teamnamen exakt zur Bestätigung eingeben.",
    };
  }

  const sessionIds = team.quiz_team_sessions.map(({ quiz_team_session_id }) =>
    quiz_team_session_id,
  );
  const answerIds = team.quiz_team_sessions.flatMap(({ team_antworten }) =>
    team_antworten.map(({ team_antwort_id }) => team_antwort_id),
  );
  const affectedQuizIds = [
    ...new Set([
      ...team.quiz_team_sessions.map(({ quiz_id }) => quiz_id),
      ...team.quiz_teams.map(({ quiz_id }) => quiz_id),
    ]),
  ];

  if (sessionIds.length > 0) {
    await transaction.team_answer_submissions.deleteMany({
      where: { quiz_team_session_id: { in: sessionIds } },
    });
  }
  if (answerIds.length > 0) {
    await transaction.team_antwort_auswahlen.deleteMany({
      where: { team_antwort_id: { in: answerIds } },
    });
    await transaction.team_antwortfelder.deleteMany({
      where: { team_antwort_id: { in: answerIds } },
    });
    await transaction.team_antworten.deleteMany({
      where: { team_antwort_id: { in: answerIds } },
    });
  }
  if (sessionIds.length > 0) {
    await transaction.quiz_interaction_runs.updateMany({
      where: { stopped_by_team_session_id: { in: sessionIds } },
      data: { stopped_by_team_session_id: null },
    });
    await transaction.quiz_team_sessions.deleteMany({
      where: { quiz_team_session_id: { in: sessionIds } },
    });
  }
  await transaction.quiz_teams.deleteMany({ where: { team_id: input.teamId } });
  await transaction.teams.delete({ where: { team_id: input.teamId } });

  for (const quizId of affectedQuizIds) {
    const statistics = await transaction.quiz_team_sessions.aggregate({
      where: { quiz_id: quizId },
      _count: { quiz_team_session_id: true },
      _sum: { spieler_anzahl: true },
    });
    await transaction.quiz.update({
      where: { quiz_id: quizId },
      data: {
        team_anzahl: statistics._count.quiz_team_session_id,
        teilnehmer_anzahl: statistics._sum.spieler_anzahl ?? 0,
      },
    });
  }

  return {
    status: "deleted",
    participationCount: team.quiz_team_sessions.length,
    affectedQuizIds,
  };
}
