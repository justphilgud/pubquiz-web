import assert from "node:assert/strict";
import test from "node:test";
import { buildYearlyRanking, type YearlyQuizTeamScore } from "./yearlyRanking";

const identity = { avatarCode: "teekanne" as const, photoUrl: null };

test("yearly ranking compares competition places before and after the current quiz", () => {
  const scores: YearlyQuizTeamScore[] = [
    { quizId: 1, teamId: 1, teamname: "Aufsteiger", punkte: 10, ...identity },
    { quizId: 1, teamId: 2, teamname: "Absteiger", punkte: 20, ...identity },
    { quizId: 2, teamId: 1, teamname: "Aufsteiger", punkte: 20, ...identity },
    { quizId: 2, teamId: 2, teamname: "Absteiger", punkte: 0, ...identity },
    { quizId: 2, teamId: 3, teamname: "Neu dabei", punkte: 25, ...identity },
  ];

  const ranking = buildYearlyRanking(scores, 2);
  assert.deepEqual(
    ranking.map(({ teamname, place, previousPlace, trend, punkte }) => ({ teamname, place, previousPlace, trend, punkte })),
    [
      { teamname: "Aufsteiger", place: 1, previousPlace: 2, trend: "UP", punkte: 30 },
      { teamname: "Neu dabei", place: 2, previousPlace: null, trend: "SAME", punkte: 25 },
      { teamname: "Absteiger", place: 3, previousPlace: 1, trend: "DOWN", punkte: 20 },
    ],
  );
});

test("yearly ranking keeps ties as competition ranks and reports neutral movement", () => {
  const ranking = buildYearlyRanking([
    { quizId: 1, teamId: 1, teamname: "A", punkte: 10, ...identity },
    { quizId: 1, teamId: 2, teamname: "B", punkte: 10, ...identity },
    { quizId: 2, teamId: 1, teamname: "A", punkte: 5, ...identity },
    { quizId: 2, teamId: 2, teamname: "B", punkte: 5, ...identity },
  ], 2);

  assert.deepEqual(ranking.map(({ place, previousPlace, trend }) => ({ place, previousPlace, trend })), [
    { place: 1, previousPlace: 1, trend: "SAME" },
    { place: 1, previousPlace: 1, trend: "SAME" },
  ]);
});
