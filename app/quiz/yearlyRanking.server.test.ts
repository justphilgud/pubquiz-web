import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { buildYearlyRanking, type YearlyRankingEntry } from "./yearlyRanking";

type QuizRow = { quiz_id: number; eventreihe_id: number; quiz_datum: Date; ist_archiviert: boolean };
type ScoreRow = { quiz_id: number; quiz_team_session_id: number; bewertungsstatus: string; bewertungs_version: number; points: number };

function fixture(rows: ScoreRow[]) {
  const quizzes: QuizRow[] = [
    [1, 7, "2026-09-01", false], [2, 7, "2026-10-13", false],
    [3, 8, "2026-09-01", false], [4, 7, "2025-12-31", false],
    [5, 7, "2026-11-01", false], [6, 7, "2026-09-01", true],
  ].map(([id, series, date, archived]) => ({ quiz_id: id as number, eventreihe_id: series as number, quiz_datum: new Date(date as string), ist_archiviert: archived as boolean }));
  const sessions = [11, 12, 13, 14, 15, 16, 17, 18].map(id => ({
    quiz_id: id === 11 ? 1 : id === 15 ? 3 : id === 16 ? 4 : id === 17 ? 5 : id === 18 ? 6 : 2,
    quiz_team_session_id: id,
    team: { team_id: id, teamname: `Team ${id}`, avatar_code: "teekanne", foto_url: null, foto_upload_gesperrt: false },
  }));
  const before = JSON.stringify({ quizzes, sessions, rows });
  const prisma = {
    quiz: {
      findUnique: async ({ where }: { where: { quiz_id: number } }) => quizzes.find(q => q.quiz_id === where.quiz_id),
      findMany: async ({ where }: { where: { eventreihe_id: number; ist_archiviert: boolean; OR: ({ quiz_id: number } | { quiz_datum: { gte: Date; lte: Date } })[] } }) => {
        assert.equal(where.eventreihe_id, 7);
        assert.equal(where.ist_archiviert, false);
        return quizzes.filter(q => q.eventreihe_id === where.eventreihe_id && q.ist_archiviert === where.ist_archiviert && where.OR.some(clause =>
          "quiz_id" in clause ? q.quiz_id === clause.quiz_id : q.quiz_datum >= clause.quiz_datum.gte && q.quiz_datum <= clause.quiz_datum.lte));
      },
    },
    quiz_team_sessions: { findMany: async ({ where }: { where: { quiz_id: { in: number[] } } }) => sessions.filter(s => where.quiz_id.in.includes(s.quiz_id)) },
    team_antworten: {
      groupBy: async ({ where }: { where: { quiz_id: { in: number[] }; OR: ({ bewertungsstatus: { in: string[] } } | { bewertungsstatus: string; bewertungs_version: { gt: number } })[] } }) => {
        const selected = rows.filter(row => where.quiz_id.in.includes(row.quiz_id) && where.OR.some(clause =>
          typeof clause.bewertungsstatus === "string"
            ? row.bewertungsstatus === clause.bewertungsstatus && row.bewertungs_version > ("bewertungs_version" in clause ? clause.bewertungs_version.gt : Infinity)
            : clause.bewertungsstatus.in.includes(row.bewertungsstatus)));
        return selected.map(row => ({ quiz_team_session_id: row.quiz_team_session_id, _sum: { vergebene_punkte: row.points } }));
      },
    },
  };
  const exports: { loadYearlyRanking?: (id: number) => Promise<YearlyRankingEntry[]> } = {};
  const source = readFileSync(new URL("./yearlyRanking.server.ts", import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, Date,
    require: (id: string) => {
      if (id === "server-only") return {};
      if (id.endsWith("/lib/prisma")) return { prisma };
      if (id.endsWith("/teams/teamProfile")) return { mapTeamProfile: () => ({ avatarCode: "teekanne" }) };
      if (id === "./yearlyRanking") return { buildYearlyRanking };
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return { load: () => exports.loadYearlyRanking!(2), unchanged: () => assert.equal(JSON.stringify({ quizzes, sessions, rows }), before) };
}

test("yearly query excludes mere registrations, pending drafts, another series/year, future and archived quizzes; valid zero remains", async () => {
  const data = fixture([
    { quiz_id: 1, quiz_team_session_id: 11, points: 7, bewertungsstatus: "CORRECT", bewertungs_version: 0 },
    { quiz_id: 2, quiz_team_session_id: 12, points: 0, bewertungsstatus: "WRONG", bewertungs_version: 0 },
    { quiz_id: 2, quiz_team_session_id: 13, points: 0, bewertungsstatus: "UNANSWERED", bewertungs_version: 0 },
    { quiz_id: 2, quiz_team_session_id: 14, points: 2, bewertungsstatus: "REVIEW_REQUIRED", bewertungs_version: 3 },
    ...[3, 4, 5, 6].map((quiz_id, index) => ({ quiz_id, quiz_team_session_id: 15 + index, points: 999, bewertungsstatus: "CORRECT", bewertungs_version: 3 })),
  ]);
  const result = await data.load();
  assert.deepEqual(result.map(t => [t.teamname, t.punkte]), [["Team 11", 7], ["Team 12", 0]]);
  assert.deepEqual(await data.load(), result);
  data.unchanged();
});

test("yearly context without evaluated answers is empty without deleting registered teams", async () => {
  const data = fixture([]);
  assert.deepEqual(await data.load(), []);
  data.unchanged();
});
