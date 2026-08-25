import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { mapTeamProfile } from "@/app/teams/teamProfile";
import { buildYearlyRanking } from "./yearlyRanking";

export async function loadYearlyRanking(quizId: number) {
  const currentQuiz = await prisma.quiz.findUnique({
    where: { quiz_id: quizId },
    select: { quiz_id: true, eventreihe_id: true, quiz_datum: true },
  });
  if (!currentQuiz) return [];

  const referenceDate = currentQuiz.quiz_datum ?? new Date();
  const yearStart = new Date(Date.UTC(referenceDate.getUTCFullYear(), 0, 1));
  const eligibleQuizzes = await prisma.quiz.findMany({
    where: {
      eventreihe_id: currentQuiz.eventreihe_id,
      ist_archiviert: false,
      OR: [
        { quiz_datum: { gte: yearStart, lte: referenceDate } },
        { quiz_id: quizId },
      ],
    },
    select: { quiz_id: true },
  });
  const quizIds = eligibleQuizzes.map((quiz) => quiz.quiz_id);
  if (quizIds.length === 0) return [];

  const [sessions, totals] = await Promise.all([
    prisma.quiz_team_sessions.findMany({
      where: { quiz_id: { in: quizIds } },
      select: {
        quiz_id: true,
        quiz_team_session_id: true,
        team: {
          select: {
            team_id: true,
            teamname: true,
            avatar_code: true,
            foto_url: true,
            foto_upload_gesperrt: true,
          },
        },
      },
    }),
    prisma.team_antworten.groupBy({
      by: ["quiz_team_session_id"],
      where: { quiz_id: { in: quizIds } },
      _sum: { vergebene_punkte: true },
    }),
  ]);
  const totalsBySession = new Map(
    totals.map((entry) => [
      entry.quiz_team_session_id,
      entry._sum.vergebene_punkte ?? new Prisma.Decimal(0),
    ]),
  );

  return buildYearlyRanking(
    sessions.map((session) => ({
      quizId: session.quiz_id,
      teamId: session.team.team_id,
      teamname: session.team.teamname,
      punkte: Number(totalsBySession.get(session.quiz_team_session_id) ?? 0),
      avatarCode: mapTeamProfile(session.team).avatarCode,
      photoUrl: session.team.foto_url,
    })),
    quizId,
  );
}
