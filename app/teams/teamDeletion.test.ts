import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@/app/generated/prisma/client";
import { deleteTeamInTransaction } from "./teamDeletion";

type TeamSnapshot = {
  teamname: string;
  quiz_teams: Array<{ quiz_id: number }>;
  quiz_team_sessions: Array<{
    quiz_team_session_id: number;
    quiz_id: number;
    team_antworten: Array<{ team_antwort_id: number }>;
  }>;
};

function createTransaction(team: TeamSnapshot | null) {
  const calls: Array<{ operation: string; args: unknown }> = [];
  const mutation = (operation: string) => async (args: unknown) => {
    calls.push({ operation, args });
    return { count: 1 };
  };
  const transaction = {
    teams: {
      findUnique: async (args: unknown) => {
        calls.push({ operation: "teams.findUnique", args });
        return team;
      },
      delete: mutation("teams.delete"),
    },
    team_answer_submissions: {
      deleteMany: mutation("team_answer_submissions.deleteMany"),
    },
    team_antwort_auswahlen: {
      deleteMany: mutation("team_antwort_auswahlen.deleteMany"),
    },
    team_antwortfelder: {
      deleteMany: mutation("team_antwortfelder.deleteMany"),
    },
    team_antworten: {
      deleteMany: mutation("team_antworten.deleteMany"),
    },
    quiz_interaction_runs: {
      updateMany: mutation("quiz_interaction_runs.updateMany"),
    },
    quiz_team_sessions: {
      deleteMany: mutation("quiz_team_sessions.deleteMany"),
      aggregate: async (args: unknown) => {
        calls.push({ operation: "quiz_team_sessions.aggregate", args });
        return {
          _count: { quiz_team_session_id: 2 },
          _sum: { spieler_anzahl: 7 },
        };
      },
    },
    quiz_teams: {
      deleteMany: mutation("quiz_teams.deleteMany"),
    },
    quiz: {
      update: mutation("quiz.update"),
    },
  } as unknown as Prisma.TransactionClient;

  return { transaction, calls };
}

test("normal delete physically removes a team without quiz history", async () => {
  const { transaction, calls } = createTransaction({
    teamname: "Neu",
    quiz_teams: [],
    quiz_team_sessions: [],
  });

  const result = await deleteTeamInTransaction(transaction, {
    teamId: 17,
    force: false,
    confirmation: "",
  });

  assert.deepEqual(result, {
    status: "deleted",
    participationCount: 0,
    affectedQuizIds: [],
  });
  assert.deepEqual(
    calls.map(({ operation }) => operation),
    ["teams.findUnique", "quiz_teams.deleteMany", "teams.delete"],
  );
});

test("normal delete blocks a team with a quiz assignment but no session", async () => {
  const { transaction, calls } = createTransaction({
    teamname: "Historisch",
    quiz_teams: [{ quiz_id: 4 }],
    quiz_team_sessions: [],
  });

  const result = await deleteTeamInTransaction(transaction, {
    teamId: 18,
    force: false,
    confirmation: "",
  });

  assert.equal(result.status, "blocked");
  assert.match(result.message, /archivieren.*Force Delete/);
  assert.deepEqual(calls.map(({ operation }) => operation), ["teams.findUnique"]);
});

test("normal delete blocks a team with a quiz session", async () => {
  const { transaction, calls } = createTransaction({
    teamname: "Historisch",
    quiz_teams: [],
    quiz_team_sessions: [
      { quiz_team_session_id: 21, quiz_id: 4, team_antworten: [] },
    ],
  });

  const result = await deleteTeamInTransaction(transaction, {
    teamId: 18,
    force: false,
    confirmation: "",
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(calls.map(({ operation }) => operation), ["teams.findUnique"]);
});

test("force delete requires the exact team name before changing data", async () => {
  const { transaction, calls } = createTransaction({
    teamname: "Exakter Name",
    quiz_teams: [{ quiz_id: 4 }],
    quiz_team_sessions: [],
  });

  const result = await deleteTeamInTransaction(transaction, {
    teamId: 19,
    force: true,
    confirmation: "exakter name",
  });

  assert.equal(result.status, "confirmation_mismatch");
  assert.deepEqual(calls.map(({ operation }) => operation), ["teams.findUnique"]);
});

test("admin force delete removes dependent team data in constraint-safe order", async () => {
  const { transaction, calls } = createTransaction({
    teamname: "Finalisten",
    quiz_teams: [{ quiz_id: 5 }],
    quiz_team_sessions: [
      {
        quiz_team_session_id: 31,
        quiz_id: 3,
        team_antworten: [
          { team_antwort_id: 41 },
          { team_antwort_id: 42 },
        ],
      },
    ],
  });

  const result = await deleteTeamInTransaction(transaction, {
    teamId: 20,
    force: true,
    confirmation: "Finalisten",
  });

  assert.deepEqual(result, {
    status: "deleted",
    participationCount: 1,
    affectedQuizIds: [3, 5],
  });
  assert.deepEqual(
    calls.map(({ operation }) => operation),
    [
      "teams.findUnique",
      "team_answer_submissions.deleteMany",
      "team_antwort_auswahlen.deleteMany",
      "team_antwortfelder.deleteMany",
      "team_antworten.deleteMany",
      "quiz_interaction_runs.updateMany",
      "quiz_team_sessions.deleteMany",
      "quiz_teams.deleteMany",
      "teams.delete",
      "quiz_team_sessions.aggregate",
      "quiz.update",
      "quiz_team_sessions.aggregate",
      "quiz.update",
    ],
  );
  assert.deepEqual(calls[1]?.args, {
    where: { quiz_team_session_id: { in: [31] } },
  });
  assert.deepEqual(calls[2]?.args, {
    where: { team_antwort_id: { in: [41, 42] } },
  });
});

test("missing teams return an expected domain result without mutations", async () => {
  const { transaction, calls } = createTransaction(null);

  const result = await deleteTeamInTransaction(transaction, {
    teamId: 404,
    force: false,
    confirmation: "",
  });

  assert.equal(result.status, "not_found");
  assert.deepEqual(calls.map(({ operation }) => operation), ["teams.findUnique"]);
});
