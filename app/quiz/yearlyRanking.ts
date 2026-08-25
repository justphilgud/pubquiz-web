import type { TeamAvatarCode } from "@/app/teams/teamProfile";
import { rankScores } from "@/app/rendering/presentation/presentationRankingPolicy";

export type YearlyQuizTeamScore = {
  quizId: number;
  teamId: number;
  teamname: string;
  punkte: number;
  avatarCode: TeamAvatarCode;
  photoUrl: string | null;
};

export type YearlyRankingEntry = {
  teamId: number;
  teamname: string;
  punkte: number;
  avatarCode: TeamAvatarCode;
  photoUrl: string | null;
  place: number;
  previousPlace: number | null;
  trend: "UP" | "DOWN" | "SAME";
};

export function buildYearlyRanking(
  scores: readonly YearlyQuizTeamScore[],
  currentQuizId: number,
): YearlyRankingEntry[] {
  const teams = new Map<number, Omit<YearlyQuizTeamScore, "quizId" | "punkte"> & {
    currentPoints: number;
    previousPoints: number;
    hasPreviousQuiz: boolean;
  }>();

  for (const score of scores) {
    const current = teams.get(score.teamId) ?? {
      teamId: score.teamId,
      teamname: score.teamname,
      avatarCode: score.avatarCode,
      photoUrl: score.photoUrl,
      currentPoints: 0,
      previousPoints: 0,
      hasPreviousQuiz: false,
    };
    current.teamname = score.teamname;
    current.avatarCode = score.avatarCode;
    current.photoUrl = score.photoUrl;
    current.currentPoints += score.punkte;
    if (score.quizId !== currentQuizId) {
      current.previousPoints += score.punkte;
      current.hasPreviousQuiz = true;
    }
    teams.set(score.teamId, current);
  }

  const previousPlaces = new Map(
    rankScores(
      [...teams.values()]
        .filter((team) => team.hasPreviousQuiz)
        .map((team) => ({ teamId: team.teamId, punkte: team.previousPoints })),
    ).map((team) => [team.teamId, team.place]),
  );

  return rankScores(
    [...teams.values()].map((team) => ({ ...team, punkte: team.currentPoints })),
  ).map((team) => {
    const previousPlace = previousPlaces.get(team.teamId) ?? null;
    const trend = previousPlace === null || previousPlace === team.place
      ? "SAME"
      : team.place < previousPlace
        ? "UP"
        : "DOWN";
    return {
      teamId: team.teamId,
      teamname: team.teamname,
      punkte: team.punkte,
      avatarCode: team.avatarCode,
      photoUrl: team.photoUrl,
      place: team.place,
      previousPlace,
      trend,
    };
  });
}
