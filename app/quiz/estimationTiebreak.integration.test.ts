import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { verifiedState, tiebreakJson } from "./estimationTiebreakStore.server";
import { readTiebreakState, revealTiebreakRound, saveTiebreakAnswer, startTiebreakRound, tiebreakPlaces } from "./estimationTiebreak";

const connectionString = process.env.LOVD_TEST_DATABASE_URL;
test("real PostgreSQL: locked concurrent rounds, reload, preserved regular data, rollback and additive master data", { skip: !connectionString }, async () => {
  assert.equal(process.env.CI, "true");
  const url = new URL(connectionString!);
  assert.equal(url.hostname, "127.0.0.1");
  assert.ok(["/lovd_night_ci", "/editorial_import_ci"].includes(url.pathname));
  url.searchParams.delete("schema");
  const client = new Client({ connectionString: url.toString() });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  await client.connect();
  const marker = `lovd-night-${randomUUID()}`;
  let seriesId: number | undefined;
  const teamIds: number[] = [];
  let questionId: number | undefined;
  try {
    // Only this positively identified disposable CI database. Never migrate a remote target.
    const columns = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='pubquiz' AND table_name='quiz_praesentation_status' AND column_name='stichentscheid_json'");
    if (!columns.rowCount) await client.query(readFileSync("prisma/migrations/20261010020000_add_estimation_tiebreak_state/migration.sql", "utf8"));
    const templatesBefore = await client.query("SELECT code,name FROM pubquiz.frage_vorlagen WHERE code<>'musik' ORDER BY code");
    const musicSql = readFileSync("prisma/migrations/20261010010000_add_normal_music_template/migration.sql", "utf8");
    await client.query(musicSql); await client.query(musicSql);
    assert.deepEqual((await client.query("SELECT code,name FROM pubquiz.frage_vorlagen WHERE code<>'musik' ORDER BY code")).rows, templatesBefore.rows);
    assert.equal((await client.query("SELECT count(*)::int n FROM pubquiz.frage_vorlage_antwortfelder f JOIN pubquiz.frage_vorlagen v USING(vorlage_id) WHERE v.code='musik'")).rows[0].n, 2);
    const series = await db.eventreihen.create({ data: { name: marker, slug: marker } }); seriesId = series.eventreihe_id;
    const quiz = await db.quiz.create({ data: { eventreihe_id: seriesId, titel: marker } });
    const block = await db.quiz_abschnitte.create({ data: { quiz_id: quiz.quiz_id, titel: marker, abschnitt_typ: "FRAGEN", sortierung: 1 } });
    const question = await db.fragen.create({ data: { frage: marker } }); questionId = question.fragen_id;
    const assignment = await db.quiz_fragen.create({ data: { quiz_id: quiz.quiz_id, fragen_id: questionId, quiz_abschnitt_id: block.quiz_abschnitt_id } });
    const sessions: number[] = [];
    for (let i = 0; i < 3; i++) {
      const team = await db.teams.create({ data: { teamname: `${marker}-${i}`, teamname_normalisiert: `${marker}-${i}` } }); teamIds.push(team.team_id);
      const session = await db.quiz_team_sessions.create({ data: { quiz_id: quiz.quiz_id, team_id: team.team_id, teamname: team.teamname } }); sessions.push(session.quiz_team_session_id);
      await db.team_antworten.create({ data: { quiz_id: quiz.quiz_id, quiz_abschnitt_id: block.quiz_abschnitt_id, quiz_fragen_id: assignment.quiz_fragen_id, quiz_team_session_id: session.quiz_team_session_id, antwort_text: "Preserve me", vergebene_punkte: 10, manuelle_punkte: 10, bewertungsstatus: "CORRECT", bewertungsquelle: "MANUAL", bewertung_final: true } });
    }
    await db.quiz_praesentation_status.create({ data: { quiz_id: quiz.quiz_id, slide_key: `section:${block.quiz_abschnitt_id}:final` } });
    const snapshot = async () => JSON.stringify({ questions: await db.fragen.findMany({ where: { fragen_id: questionId } }), assignments: await db.quiz_fragen.findMany({ where: { quiz_id: quiz.quiz_id } }), answers: await db.team_antworten.findMany({ where: { quiz_id: quiz.quiz_id }, orderBy: { team_antwort_id: "asc" } }), submissions: await db.team_answer_submissions.findMany({ where: { interaction_run: { quiz_id: quiz.quiz_id } } }) });
    const before = await snapshot();
    const start = () => db.$transaction(async tx => {
      const state = startTiebreakRound(await verifiedState(tx, quiz.quiz_id), { questionId: 999, question: "Wie viele?", unit: "Stück", correctValue: 100 });
      await tx.quiz_praesentation_status.update({ where: { quiz_id: quiz.quiz_id }, data: { stichentscheid_json: tiebreakJson(state) } });
      return state;
    });
    const [first, second] = await Promise.all([start(), start()]);
    assert.equal(first.rounds.length, 1); assert.deepEqual(first, second);
    const save = (sessionId: number, value: number) => db.$transaction(async tx => {
      const state = saveTiebreakAnswer(await verifiedState(tx, quiz.quiz_id), { sessionId, roundId: 1, value, expectedRevision: 0 });
      await tx.quiz_praesentation_status.update({ where: { quiz_id: quiz.quiz_id }, data: { stichentscheid_json: tiebreakJson(state) } });
    });
    await Promise.all([save(sessions[0], 99), save(sessions[1], 101)]);
    await assert.rejects(save(-1, 100), /nicht autorisiert/);
    await db.$transaction(async tx => {
      const state = revealTiebreakRound(await verifiedState(tx, quiz.quiz_id), 1);
      await tx.quiz_praesentation_status.update({ where: { quiz_id: quiz.quiz_id }, data: { stichentscheid_json: tiebreakJson(state) } });
    });
    const stored = await db.quiz_praesentation_status.findUniqueOrThrow({ where: { quiz_id: quiz.quiz_id } });
    const restored = readTiebreakState(stored.stichentscheid_json)!;
    assert.deepEqual([...tiebreakPlaces(restored)], [[sessions[0], 1], [sessions[1], 1], [sessions[2], 3]]);
    await assert.rejects(db.$transaction(async tx => { await tx.quiz_praesentation_status.update({ where: { quiz_id: quiz.quiz_id }, data: { stichentscheid_json: tiebreakJson(startTiebreakRound(restored, { questionId: 1000, question: "Noch eine?", unit: "Stück", correctValue: 100 })) } }); throw new Error("simulate interruption"); }), /interruption/);
    assert.deepEqual((await db.quiz_praesentation_status.findUniqueOrThrow({ where: { quiz_id: quiz.quiz_id } })).stichentscheid_json, stored.stichentscheid_json);
    assert.equal(await snapshot(), before);
  } finally {
    if (seriesId) { await db.quiz.deleteMany({ where: { eventreihe_id: seriesId } }); await db.eventreihen.delete({ where: { eventreihe_id: seriesId } }); }
    if (questionId) await db.fragen.delete({ where: { fragen_id: questionId } });
    await db.teams.deleteMany({ where: { team_id: { in: teamIds } } });
    await db.$disconnect(); await client.end();
  }
});
