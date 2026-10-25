import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { issueTeamSessionToken } from "../teamSessionToken";
import { sealPng } from "./files";

function loadActual<T>(file: string, bindings: Record<string, unknown>) {
  const exports = {};
  const require = createRequire(new URL(file, import.meta.url));
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Buffer, URL, Uint8Array, AbortSignal, fetch: async () => new Response(new Uint8Array(archiveBlob)), console,
    require: (id: string) => Object.hasOwn(bindings, id) ? bindings[id] : require(id),
  });
  return exports as T;
}
let archiveBlob = Buffer.alloc(0);

const connection = process.env.MEME_ARCHIVE_TEST_DATABASE_URL;
test("real PostgreSQL: capture, explicit/auto finalization, versions, rollback, reset race and retained archive", { skip: !connection }, async () => {
  assert.equal(process.env.CI, "true");
  const url = new URL(connection!); assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.pathname, "/meme_archive_ci"); url.searchParams.delete("schema");
  const adminUrl = new URL(url); adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() }); await admin.connect();
  await admin.query("CREATE DATABASE meme_archive_ci");
  const client = new Client({ connectionString: url.toString() }); await client.connect();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const baselinePath = resolve(".meme-ci-baseline.prisma");
  try {
    const baseline = readFileSync("prisma/schema.prisma", "utf8").replace(/^\s*meme_archive_sources meme_archive_sources\[\]\r?\n/m, "").replace(/model meme_archive_sources \{[\s\S]*?^\}/m, "").replace(/model meme_archive_entries \{[\s\S]*?^\}/m, "");
    writeFileSync(baselinePath, baseline, { flag: "wx" });
    const sql = execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema", baselinePath, "--script"], { encoding: "utf8", env: { ...process.env, JITI_CACHE: "false" } });
    await client.query("CREATE SCHEMA IF NOT EXISTS pubquiz; SET search_path TO pubquiz, public");
    await client.query(sql.slice(sql.indexOf("-- CreateSchema")));
    await client.query(readFileSync("prisma/migrations/20261016120000_meme_archive/migration.sql", "utf8"));
    const series = await db.eventreihen.create({ data: { name: "Meme archive CI", slug: "meme-archive-ci" } });
    // New series have no implicit product entitlement; this fixture explicitly runs Quiz.
    await db.eventarten.create({ data: { kennung: "QUIZ", name: "Quiz" } });
    await db.eventreihe_eventarten.create({ data: { eventreihe_id: series.eventreihe_id, eventart: "QUIZ", ist_freigeschaltet: true } });
    const quiz = await db.quiz.create({ data: { eventreihe_id: series.eventreihe_id, titel: null } });
    const block = await db.quiz_abschnitte.create({ data: { quiz_id: quiz.quiz_id, titel: "CI", abschnitt_typ: "FRAGEN", sortierung: 1 } });
    const question = await db.fragen.create({ data: { frage: "Unchanged CI Meme" } });
    const assignment = await db.quiz_fragen.create({ data: { quiz_id: quiz.quiz_id, fragen_id: question.fragen_id, quiz_abschnitt_id: block.quiz_abschnitt_id } });
    await db.quiz_praesentation_status.create({ data: { quiz_id: quiz.quiz_id, lifecycle_revision: 4 } });
    const run = await db.quiz_interaction_runs.create({ data: { quiz_id: quiz.quiz_id, quiz_fragen_id: assignment.quiz_fragen_id, interaction_type: "MEME_CAPTION", state: "OPEN", config_snapshot: { interaction: { type: "MEME_CAPTION", imageUrl: "/medien/ci.png", layout: { version: 1, mode: "STANDARD" } } } } });
    const teams: { team: { team_id: number }; session: { quiz_team_session_id: number }; answer: { team_antwort_id: number } }[] = [];
    for (let i = 0; i < 3; i++) {
      const team = await db.teams.create({ data: { teamname: `CI ${i}`, teamname_normalisiert: `ci-${i}` } });
      const session = await db.quiz_team_sessions.create({ data: { quiz_id: quiz.quiz_id, team_id: team.team_id, teamname: team.teamname } });
      const answer = await db.team_antworten.create({ data: { quiz_id: quiz.quiz_id, quiz_abschnitt_id: block.quiz_abschnitt_id, quiz_fragen_id: assignment.quiz_fragen_id, quiz_team_session_id: session.quiz_team_session_id, interaction_run_id: run.interaction_run_id } });
      teams.push({ team, session, answer });
    }
    const submission = (i: number, version: number, status: "SUBMITTED" | "AUTO_FINALIZED" = "SUBMITTED") => ({ interaction_run_id: run.interaction_run_id, team_antwort_id: teams[i].answer.team_antwort_id, quiz_team_session_id: teams[i].session.quiz_team_session_id, submission_version: version, draft_revision: version, interaction_type: "MEME_CAPTION", status, payload: { topText: `Version ${version}`, bottomText: "ÄÖÜ" } });
    await db.team_answer_submissions.create({ data: submission(0, 1) });
    await db.team_answer_submissions.create({ data: submission(1, 1, "AUTO_FINALIZED") });
    await Promise.all([1, 2].map(() => db.team_answer_submissions.createMany({ data: [submission(0, 2)], skipDuplicates: true })));
    assert.equal(await db.meme_archive_entries.count(), 3);
    const uploadedPaths = new Set<string>();
    const repository = loadActual<Pick<typeof import("./archive.server"), "listMemeArchive" | "loadArchivedPng" | "processMemeArchive" | "deleteArchivedMeme">>("./archive.server.ts", {
      "server-only": {}, "@/app/lib/prisma": { prisma: db },
      "@/app/fragen/editor/mediaUploadEnvironment": { getMediaVerificationServerConfig: () => ({ blobAuthentication: {} }), buildMediaUploadPathname: (_area: string, segments: string[]) => segments.join("/") },
      "./png": { renderArchivedMeme: async () => Buffer.from("confirmed PNG") },
      "@vercel/blob": { put: async (path: string) => { assert.ok(!uploadedPaths.has(path), "no duplicate parallel upload"); uploadedPaths.add(path); return { url: `https://test.public.blob.vercel-storage.com/${path}` }; }, del: async () => {} },
    });
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(77116,$1)", [quiz.quiz_id]);
    try {
      await repository.processMemeArchive(quiz.quiz_id, 1);
      assert.equal(await db.meme_archive_entries.count({ where: { status: "PENDING" } }), 3, "busy archive worker returns without touching submissions");
      await assert.rejects(db.$transaction(async tx => {
        await tx.$executeRaw`SET LOCAL lock_timeout='1s'`;
        await tx.$queryRaw`SELECT quiz_id FROM pubquiz.quiz WHERE quiz_id=${quiz.quiz_id} FOR UPDATE`;
        await tx.team_answer_submissions.create({ data: submission(2, 1) });
        throw new Error("normal answer reached commit boundary while archive busy");
      }), /normal answer reached commit boundary/);
    } finally { await client.query("ROLLBACK"); }
    await db.meme_archive_sources.update({ where: { source_id: run.interaction_run_id }, data: { image_bytes: new Uint8Array([1, 2, 3]) } });
    for (let round = 0; round < 10 && await db.meme_archive_entries.count({ where: { status: { not: "READY" } } }); round++) {
      await Promise.all(Array.from({ length: 4 }, () => repository.processMemeArchive(quiz.quiz_id)));
    }
    assert.equal(await db.meme_archive_entries.count({ where: { status: "READY" } }), 3);
    assert.equal(uploadedPaths.size, 3);
    const participant = loadActual<Pick<typeof import("../participantSession.server"), "resolveParticipantSession">>("../participantSession.server.ts", {
      "@/app/lib/prisma": { prisma: db }, "./teamSessionSecret.server": { getTeamSessionSigningSecret: () => "isolated-ci-secret" },
    });
    const token = issueTeamSessionToken({ quizId: quiz.quiz_id, sessionId: teams[0].session.quiz_team_session_id }, "isolated-ci-secret");
    assert.ok(await participant.resolveParticipantSession(quiz.quiz_id, token));
    assert.equal(await participant.resolveParticipantSession(quiz.quiz_id, token + "forged"), null);
    assert.equal((await repository.listMemeArchive(quiz.quiz_id, teams[0].session.quiz_team_session_id)).length, 1);
    const own = (await repository.listMemeArchive(quiz.quiz_id, teams[0].session.quiz_team_session_id))[0];
    const encrypted = sealPng(Buffer.from("confirmed PNG")); archiveBlob = Buffer.from(encrypted.bytes);
    await db.meme_archive_entries.update({ where: { entry_id: own.id }, data: { status: "READY", blob_url: "https://test.public.blob.vercel-storage.com/test.bin", encryption_key: encrypted.key, png_sha256: encrypted.sha256 } });
    assert.equal((await repository.loadArchivedPng(quiz.quiz_id, own.id, teams[0].session.quiz_team_session_id)).png.toString(), "confirmed PNG");
    await assert.rejects(repository.loadArchivedPng(quiz.quiz_id, own.id, teams[1].session.quiz_team_session_id));
    const old = await db.meme_archive_entries.findFirstOrThrow({ where: { session_id: teams[0].session.quiz_team_session_id, submission_version: 1 } });
    await db.meme_archive_entries.update({ where: { entry_id: old.entry_id }, data: { status: "READY", blob_url: "https://test.public.blob.vercel-storage.com/test.bin", encryption_key: encrypted.key, png_sha256: encrypted.sha256 } });
    await assert.rejects(repository.loadArchivedPng(quiz.quiz_id, old.entry_id, teams[0].session.quiz_team_session_id), /nicht mehr aktuell/);
    // A second internal run still belongs to the same question/quiz lifecycle.
    const repeatedRun = await db.quiz_interaction_runs.create({ data: { quiz_id: quiz.quiz_id, quiz_fragen_id: assignment.quiz_fragen_id, interaction_type: "MEME_CAPTION", state: "OPEN", config_snapshot: run.config_snapshot! } });
    await db.team_answer_submissions.create({ data: { ...submission(0, 1), interaction_run_id: repeatedRun.interaction_run_id } });
    const repeatedItems = await repository.listMemeArchive(quiz.quiz_id, teams[0].session.quiz_team_session_id);
    assert.equal(repeatedItems.length, 1); assert.equal(repeatedItems[0].sourceId, repeatedRun.interaction_run_id);
    await assert.rejects(repository.loadArchivedPng(quiz.quiz_id, own.id, teams[0].session.quiz_team_session_id), /nicht mehr aktuell/);
    // Remove only this extra isolated fixture, restoring the three original entries.
    await db.meme_archive_entries.deleteMany({ where: { source_id: repeatedRun.interaction_run_id } });
    await db.meme_archive_sources.delete({ where: { source_id: repeatedRun.interaction_run_id } });
    await db.quiz_interaction_runs.delete({ where: { interaction_run_id: repeatedRun.interaction_run_id } });
    // Explicit historical capture uses the same idempotent function and changes no answer.
    await client.query("SELECT pubquiz.archive_meme_submission(a) FROM pubquiz.team_answer_submissions a");
    assert.equal(await db.meme_archive_entries.count(), 3);
    assert.equal((await db.meme_archive_sources.findUniqueOrThrow({ where: { source_id: run.interaction_run_id } })).lifecycle_revision, 4);
    await assert.rejects(db.$transaction(async tx => { await tx.team_answer_submissions.create({ data: submission(2, 1) }); throw new Error("rollback"); }), /rollback/);
    assert.equal(await db.meme_archive_entries.count(), 3);
    await db.meme_archive_sources.update({ where: { source_id: run.interaction_run_id }, data: { image_bytes: null } });
    await assert.rejects(client.query("SELECT pubquiz.assert_meme_archive_reset_safe($1)", [quiz.quiz_id]), /noch nicht gesichert/);
    // Durable image bytes allow retry even if PNG upload failed and runtime is removed.
    await db.meme_archive_sources.update({ where: { source_id: run.interaction_run_id }, data: { image_bytes: new Uint8Array([1, 2, 3]) } });
    await db.meme_archive_entries.updateMany({ data: { status: "ERROR" } });
    const before = await db.meme_archive_entries.findMany({ orderBy: { submission_id: "asc" } });
    const contender = new Client({ connectionString: url.toString() }); await contender.connect();
    try {
      await client.query("BEGIN"); await client.query("SELECT quiz_id FROM pubquiz.quiz WHERE quiz_id=$1 FOR UPDATE", [quiz.quiz_id]);
      const lateFinalization = (async () => {
        try {
          await contender.query("BEGIN");
          await contender.query("SELECT quiz_id FROM pubquiz.quiz WHERE quiz_id=$1 FOR UPDATE", [quiz.quiz_id]);
          await contender.query("INSERT INTO pubquiz.team_answer_submissions(interaction_run_id,team_antwort_id,quiz_team_session_id,submission_version,draft_revision,interaction_type,status,payload) VALUES($1,$2,$3,1,1,'MEME_CAPTION','AUTO_FINALIZED','{\"topText\":\"late\",\"bottomText\":\"\"}')", [run.interaction_run_id, teams[2].answer.team_antwort_id, teams[2].session.quiz_team_session_id]);
          await contender.query("COMMIT"); return "saved";
        } catch { await contender.query("ROLLBACK"); return "rejected"; }
      })();
      await client.query("SELECT pubquiz.assert_meme_archive_reset_safe($1)", [quiz.quiz_id]);
      await client.query("DELETE FROM pubquiz.quiz_team_sessions WHERE quiz_id=$1", [quiz.quiz_id]);
      await client.query("DELETE FROM pubquiz.quiz_interaction_runs WHERE quiz_id=$1", [quiz.quiz_id]);
      await client.query("UPDATE pubquiz.quiz_praesentation_status SET lifecycle_revision=lifecycle_revision+1 WHERE quiz_id=$1", [quiz.quiz_id]);
      await client.query("COMMIT");
      assert.equal(await lateFinalization, "rejected");
    } finally { await contender.end(); }
    assert.deepEqual(await db.meme_archive_entries.findMany({ orderBy: { submission_id: "asc" } }), before);
    assert.equal(await db.quiz_team_sessions.count(), 0);
    assert.equal(await participant.resolveParticipantSession(quiz.quiz_id, token), null);
    assert.equal((await repository.listMemeArchive(quiz.quiz_id)).length, 2);
    await db.meme_archive_entries.update({ where: { entry_id: own.id }, data: { status: "DELETED" } });
    assert.equal((await repository.listMemeArchive(quiz.quiz_id, teams[0].session.quiz_team_session_id)).length, 0, "deleting latest must never resurrect an older version");
    assert.equal((await db.fragen.findUniqueOrThrow({ where: { fragen_id: question.fragen_id } })).frage, "Unchanged CI Meme");
    assert.equal(await db.quiz_fragen.count(), 1);
    // No team FK, no reset/runtime FK; full quiz delete is restricted until explicit archive removal.
    await db.teams.deleteMany();
    await assert.rejects(db.quiz.delete({ where: { quiz_id: quiz.quiz_id } }));
    const latest = await client.query("SELECT DISTINCT ON(source_id,session_id) submission_version,status FROM pubquiz.meme_archive_entries ORDER BY source_id,session_id,submission_version DESC");
    assert.deepEqual(latest.rows.map(r => r.submission_version).sort(), [1, 2]);
    const archivedB = (await repository.listMemeArchive(quiz.quiz_id, teams[1].session.quiz_team_session_id))[0];
    await repository.deleteArchivedMeme(quiz.quiz_id, archivedB.id);
    const deletedB = await db.meme_archive_entries.findUniqueOrThrow({ where: { entry_id: archivedB.id } });
    assert.equal(deletedB.status, "DELETED"); assert.equal(deletedB.encryption_key, null); assert.equal(deletedB.blob_url, null);
  } finally {
    try { unlinkSync(baselinePath); } catch { /* no baseline left */ }
    await db.$disconnect(); await client.end();
    await admin.query("DROP DATABASE meme_archive_ci WITH (FORCE)"); await admin.end();
  }
});
