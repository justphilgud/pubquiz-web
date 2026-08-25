import "server-only";

import { prisma } from "@/app/lib/prisma";
import {
  normalizeTeamName,
  normalizeTeamPassword,
  teamPasswordMatches,
  validateTeamName,
} from "./teamIdentity";
import { generateTeamPassword } from "./teamPassword";
import { mapTeamProfile } from "./teamProfile";
import { shouldOpenTeamProfileOnboarding } from "./teamProfileOnboarding";

type StartTeamSessionInput = {
  quizId: number;
  teamName: string;
  playerCount: number;
  password?: string;
};

export type StartTeamSessionResult =
  | {
      success: true;
      generatedPassword: string | null;
      session: {
        quiz_team_session_id: number;
        team_id: number;
        teamname: string;
      };
      profile: ReturnType<typeof mapTeamProfile>;
      profileOnboarding: boolean;
    }
  | { success: false; message: string };

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function startGlobalTeamQuizSession(
  input: StartTeamSessionInput,
): Promise<StartTeamSessionResult> {
  const teamName = input.teamName.trim();
  const nameError = validateTeamName(teamName);
  if (nameError) return { success: false, message: nameError };

  const normalizedName = normalizeTeamName(teamName);
  const suppliedPassword = normalizeTeamPassword(input.password);

  const execute = () => prisma.$transaction(async (transaction) => {
    const quiz = await transaction.quiz.findFirst({
      where: { quiz_id: input.quizId, ist_archiviert: false },
      select: { quiz_id: true },
    });
    if (!quiz) return { success: false, message: "Quiz nicht gefunden." } as const;

    let generatedPassword: string | null = null;
    let team = await transaction.teams.findUnique({
      where: { teamname_normalisiert: normalizedName },
    });
    const teamWasCreated = team === null;

    if (!team) {
      generatedPassword = generateTeamPassword();
      team = await transaction.teams.create({
        data: {
          teamname: teamName,
          teamname_normalisiert: normalizedName,
          team_passwort: generatedPassword,
        },
      });
    } else {
      if (team.ist_archiviert) {
        return {
          success: false,
          message: "Dieses Team ist archiviert. Bitte wendet euch an die Quizleitung.",
        } as const;
      }
      if (!teamPasswordMatches(team.team_passwort, suppliedPassword)) {
        return {
          success: false,
          message: "Falsches Team-Passwort. Dieses Team existiert bereits – bitte meldet euch mit eurem Team-Passwort an.",
        } as const;
      }
      if (!team.team_passwort) {
        generatedPassword = generateTeamPassword();
        team = await transaction.teams.update({
          where: { team_id: team.team_id },
          data: { team_passwort: generatedPassword },
        });
      }
    }

    const existingSession = await transaction.quiz_team_sessions.findUnique({
      where: {
        quiz_id_team_id: {
          quiz_id: input.quizId,
          team_id: team.team_id,
        },
      },
      select: { quiz_team_session_id: true },
    });

    const session = await transaction.quiz_team_sessions.upsert({
      where: {
        quiz_id_team_id: {
          quiz_id: input.quizId,
          team_id: team.team_id,
        },
      },
      update: {
        teamname: team.teamname,
        spieler_anzahl: input.playerCount,
      },
      create: {
        quiz_id: input.quizId,
        team_id: team.team_id,
        teamname: team.teamname,
        spieler_anzahl: input.playerCount,
      },
    });

    await transaction.quiz_teams.upsert({
      where: { quiz_id_team_id: { quiz_id: input.quizId, team_id: team.team_id } },
      update: {},
      create: { quiz_id: input.quizId, team_id: team.team_id },
    });

    const statistics = await transaction.quiz_team_sessions.aggregate({
      where: { quiz_id: input.quizId },
      _count: { quiz_team_session_id: true },
      _sum: { spieler_anzahl: true },
    });
    await transaction.quiz.update({
      where: { quiz_id: input.quizId },
      data: {
        team_anzahl: statistics._count.quiz_team_session_id,
        teilnehmer_anzahl: statistics._sum.spieler_anzahl ?? 0,
      },
    });

    return {
      success: true,
      generatedPassword,
      session: {
        quiz_team_session_id: session.quiz_team_session_id,
        team_id: team.team_id,
        teamname: team.teamname,
      },
      profile: mapTeamProfile(team),
      profileOnboarding: shouldOpenTeamProfileOnboarding({
        teamWasCreated,
        teamAlreadyJoinedQuiz: existingSession !== null,
      }),
    } as const;
  });

  try {
    return await execute();
  } catch (error) {
    if (isUniqueConflict(error)) return execute();
    throw error;
  }
}
