import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";
import * as identity from "./teamIdentity";

test("lost join response can be recovered only with the original request proof; password device switch still works", async () => {
  type Row = Record<string, unknown>;
  let team: Row | null = null;
  let session: Row | null = null;
  let creates = 0;
  const tx = {
    quiz: { findFirst: async () => ({ quiz_id: 7 }), update: async () => ({}) },
    teams: {
      findUnique: async () => team,
      create: async ({ data }: { data: Row }) => { creates++; return team = { ...data, team_id: 9, ist_archiviert: false }; },
    },
    quiz_team_sessions: {
      findUnique: async () => session,
      upsert: async ({ create }: { create: Row }) => session ??= { ...create, quiz_team_session_id: 11, erstellt_am: new Date() },
      aggregate: async () => ({ _count: { quiz_team_session_id: 1 }, _sum: { spieler_anzahl: 2 } }),
    },
    quiz_teams: { upsert: async () => ({}) },
  };
  const exports: { startGlobalTeamQuizSession?: (input: Row) => Promise<{ success: boolean; generatedPassword: string | null; session: { quiz_team_session_id: number } }> } = {};
  runInNewContext(ts.transpileModule(readFileSync("app/teams/teamSession.server.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, require: (name: string) => {
    if (name === "server-only") return {};
    if (name === "node:crypto") return { createHash };
    if (name.endsWith("quizLifecycle.server")) return { requireQuizNotStopped: async () => ({}) };
    if (name.endsWith("lib/prisma")) return { prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
    if (name === "./teamIdentity") return identity;
    if (name === "./teamPassword") return { generateTeamPassword: () => "Otter" };
    if (name === "./teamProfile") return { mapTeamProfile: () => ({}) };
    if (name === "./teamProfileOnboarding") return { shouldOpenTeamProfileOnboarding: () => false };
    throw new Error(name);
  } });
  const input = { quizId: 7, teamName: "Recovery", playerCount: 2, joinRequestId: "88b71153-f614-4de0-9262-c6010c7fbead" };
  const first = await exports.startGlobalTeamQuizSession!(input);
  assert.equal(first.success, true);
  // The first response is lost. A reload resends the persisted request id without a password.
  const recovered = await exports.startGlobalTeamQuizSession!(input);
  assert.equal(recovered.success, true);
  assert.equal(recovered.generatedPassword, "Otter");
  assert.equal(recovered.session.quiz_team_session_id, first.session.quiz_team_session_id);
  assert.equal(creates, 1);
  assert.equal((await exports.startGlobalTeamQuizSession!({ ...input, joinRequestId: "88b71153-f614-4de0-9262-c6010c7fbeae" })).success, false);
  assert.equal((await exports.startGlobalTeamQuizSession!({ ...input, joinRequestId: undefined })).success, false);
  assert.equal((await exports.startGlobalTeamQuizSession!({ ...input, joinRequestId: undefined, password: "Otter" })).success, true);
  (session! as Row).erstellt_am = new Date(Date.now() - 25 * 3600000);
  assert.equal((await exports.startGlobalTeamQuizSession!(input)).success, false);
});
