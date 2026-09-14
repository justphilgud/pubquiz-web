// Explicit integration test ONLY for the disposable loopback PostgreSQL cluster.
// This file is not part of the credential-bearing production workflow.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { libpqEnvironment } from "./libpq";
import { PgSession, pgTool } from "./pg-session";
import { collectSnapshot, compareSnapshots } from "./snapshot";
import { dumpArguments } from "./acceptance-backup";
import { restoreSql } from "./acceptance-restore";
const base = "postgresql://neondb_owner:ap94-synthetic-local-only@127.0.0.1/";
const url = (db: string) => `${base}${db}?sslmode=require&channel_binding=require`;
const toolEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };
const writeEnv = (db: string) => ({ ...libpqEnvironment(url(db), toolEnv), PGPORT: "55439", PGOPTIONS: "-c default_transaction_read_only=off" });
const localLaunch = (args: string[], env: NodeJS.ProcessEnv) => {
  assert.equal(env.PGHOST, "127.0.0.1");
  return spawn("psql", args, { env: { ...env, PGPORT: "55439" }, stdio: "pipe", windowsHide: true });
};
const exec = (db: string, sql: string) => pgTool("psql", ["-X", "-w", "-q", "-v", "ON_ERROR_STOP=1", "--file=-"], writeEnv(db), sql);
async function main() {
exec("postgres", "DROP DATABASE IF EXISTS fixture_source; DROP DATABASE IF EXISTS neondb; CREATE DATABASE fixture_source; CREATE DATABASE neondb;");
exec("fixture_source", `CREATE SCHEMA pubquiz;
CREATE TABLE pubquiz.users(id serial PRIMARY KEY,password_hash text NOT NULL,must_change_password boolean DEFAULT false);
CREATE TABLE pubquiz.teams(team_id serial PRIMARY KEY,team_passwort text,teamname text);
CREATE TABLE pubquiz.quiz_team_sessions(quiz_team_session_id serial PRIMARY KEY,quiz_id int,team_id int REFERENCES pubquiz.teams);
CREATE TABLE pubquiz.team_antworten(team_antwort_id serial PRIMARY KEY,quiz_team_session_id int REFERENCES pubquiz.quiz_team_sessions,vergebene_punkte numeric(12,4),bewertung_final boolean);
CREATE TABLE public._prisma_migrations(id text PRIMARY KEY,checksum text);
INSERT INTO pubquiz.users(password_hash) VALUES('SYNTHETIC_ORIGINAL_HASH_DO_NOT_BACKUP');
INSERT INTO pubquiz.teams(team_passwort,teamname) VALUES('SYNTHETIC_ORIGINAL_PASSWORD_DO_NOT_BACKUP','Öl O''Brien \\ 你好');
INSERT INTO pubquiz.quiz_team_sessions(quiz_id,team_id) VALUES(1,1);
INSERT INTO pubquiz.team_antworten(quiz_team_session_id,vergebene_punkte,bewertung_final) VALUES(1,1.2345,true);
INSERT INTO public._prisma_migrations VALUES('test-migration','synthetic-checksum');`);
const directory = await mkdtemp(join(tmpdir(), "ap94-fixture-"));
const source = new PgSession(url("fixture_source"), toolEnv, localLaunch);
const target = new PgSession(url("neondb"), toolEnv, localLaunch);
try {
  await source.sql("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL search_path=pg_catalog; SET LOCAL TIME ZONE 'UTC'; SET LOCAL DateStyle='ISO, YMD'");
  const snapshot = await source.json<string>("SELECT to_json(pg_export_snapshot())");
  const expected = await collectSnapshot(source);
  exec("fixture_source", "UPDATE pubquiz.teams SET teamname='concurrent-change' WHERE team_id=1;");
  pgTool("pg_dump", dumpArguments(snapshot, join(directory, "database.dump")), { ...libpqEnvironment(url("fixture_source"), toolEnv), PGPORT: "55439" });
  await source.sql("COMMIT");
  const dumped = pgTool("pg_restore", ["--file=-", join(directory, "database.dump")], toolEnv);
  assert.ok(!dumped.includes("SYNTHETIC_ORIGINAL")); assert.ok(!JSON.stringify(expected).includes("SYNTHETIC_ORIGINAL"));
  const sql = restoreSql(directory, expected.authRows, { expected }, toolEnv);
  pgTool("psql", ["-X", "-w", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file=-"], writeEnv("neondb"), sql);
  await target.sql("BEGIN READ ONLY; SET LOCAL search_path=pg_catalog; SET LOCAL TIME ZONE 'UTC'; SET LOCAL DateStyle='ISO, YMD'");
  compareSnapshots(expected, await collectSnapshot(target)); await target.sql("COMMIT");
  assert.throws(() => pgTool("psql", ["-X", "-w", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file=-"], writeEnv("neondb"), sql));
  assert.ok((await readFile(join(directory, "database.dump"))).length > 0);
  console.log("PASS: native TLS/channel binding; consistent concurrent snapshot; auth exclusion; standard dump/restore; Unicode/quotes/decimals/FKs/migrations/counts/hashes/results; nonempty target rejected.");
} finally { source.close(); target.close(); await rm(directory, { recursive: true, force: true }); }
}
main().catch(() => { console.error("LOCAL_INTEGRATION_FAILED"); process.exitCode = 1; });
