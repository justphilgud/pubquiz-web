import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Client } from "pg";

const databaseUrl = process.env.EIGHT_BIT_TEST_DATABASE_URL;
test("8-bit migration updates planned maxima only and is idempotent", { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Local PostgreSQL fixture only");
  const db = new Client({ connectionString: databaseUrl });
  const schema = `scoring_test_${process.pid}_${Date.now()}`;
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};
      CREATE TABLE frage_vorlagen (vorlage_id int PRIMARY KEY, code text);
      CREATE TABLE fragen (fragen_id int PRIMARY KEY, vorlage_id int);
      CREATE TABLE quiz_fragen (quiz_fragen_id int PRIMARY KEY, quiz_id int, fragen_id int, punkte_basis numeric);
      CREATE TABLE quiz_praesentation_status (quiz_id int, quiz_started_at timestamp, quiz_stopped_at timestamp);
      CREATE TABLE quiz_interaction_runs (quiz_id int);
      CREATE TABLE team_antworten (quiz_fragen_id int, vergebene_punkte numeric);
      INSERT INTO frage_vorlagen VALUES (1,'eight_bit'),(2,'musik'),(3,'music-8bit'),(4,'musik_8bit');
      INSERT INTO fragen VALUES (1,1),(2,2),(3,3),(4,4);
      INSERT INTO quiz_fragen VALUES (1,1,1,0.5),(2,2,1,0.5),(3,3,1,0.5),(4,4,1,0.5),
        (5,5,1,0.5),(6,6,2,0.5),(7,7,3,0.5),(8,8,4,0.5),(9,9,1,1);
      INSERT INTO quiz_praesentation_status VALUES (2,now(),null),(3,now(),now());
      INSERT INTO quiz_interaction_runs VALUES (4);
      INSERT INTO team_antworten VALUES (5,0.5);
    `);
    const sql = readFileSync("prisma/migrations/20261114160000_eight_bit_one_point/migration.sql", "utf8").replaceAll("pubquiz.", `${schema}.`);
    assert.equal((await db.query(sql)).rowCount, 3);
    assert.equal((await db.query(sql)).rowCount, 0);
    const rows = await db.query("SELECT punkte_basis::text AS points FROM quiz_fragen ORDER BY quiz_fragen_id");
    assert.deepEqual(rows.rows.map(r => r.points), ["1", "0.5", "0.5", "0.5", "0.5", "0.5", "1", "1", "1"]);
    assert.equal((await db.query("SELECT vergebene_punkte::text AS points FROM team_antworten")).rows[0].points, "0.5");
  } finally {
    await db.query("ROLLBACK");
    await db.end();
  }
});

test("custom 8bit migration updates only the three still unplayed assignments", { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Local PostgreSQL fixture only");
  const db = new Client({ connectionString: databaseUrl });
  const schema = `custom_scoring_test_${process.pid}_${Date.now()}`;
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};
      CREATE TABLE quiz (quiz_id int PRIMARY KEY, ist_archiviert boolean DEFAULT false);
      CREATE TABLE frage_vorlagen (vorlage_id int PRIMARY KEY, code text, art text, basis_code text, konfiguration_json jsonb, updated_at timestamp);
      CREATE TABLE fragen (fragen_id int PRIMARY KEY, vorlage_id int, source_vorlage_id int);
      CREATE TABLE quiz_fragen (quiz_fragen_id int PRIMARY KEY, quiz_id int, fragen_id int, punkte_basis numeric);
      CREATE TABLE quiz_praesentation_status (quiz_id int, quiz_started_at timestamp, quiz_stopped_at timestamp);
      CREATE TABLE quiz_interaction_runs (quiz_fragen_id int);
      CREATE TABLE team_antworten (quiz_fragen_id int, vergebene_punkte numeric);
      INSERT INTO quiz (quiz_id) VALUES (31), (37), (39);
      INSERT INTO frage_vorlagen VALUES
        (1,'musik','SYSTEM',null,null,null),
        (24,'dynamic_58391516-ff5b-4694-995f-f5b8d58d0785','DYNAMIC','musik','{"version":1,"media":[{"slotKey":"music_original_audio"}]}',null),
        (25,'other-dynamic','DYNAMIC','musik','{"version":1}',null);
      INSERT INTO fragen VALUES (1385,1,24),(1818,1,24),(1819,1,24),(1821,1,24),(1900,1,25);
      INSERT INTO quiz_fragen VALUES (204,31,1385,0.5),(466,39,1821,0.5),(469,37,1819,0.5),(470,39,1818,0.5),(480,37,1900,0.5),(481,39,1819,0.5);
      INSERT INTO quiz_praesentation_status VALUES (31,now(),now());
      INSERT INTO quiz_interaction_runs VALUES (204),(480);
      INSERT INTO team_antworten VALUES (204,0.5),(480,0.5);
    `);
    const sql = readFileSync("prisma/migrations/20261114180000_custom_eight_bit_scoring/migration.sql", "utf8").replaceAll("pubquiz.", `${schema}.`);
    await db.query("SAVEPOINT before_fix");
    await db.query("INSERT INTO quiz_interaction_runs VALUES (466); INSERT INTO team_antworten VALUES (469,0.5); INSERT INTO quiz_praesentation_status VALUES (39,now(),null);");
    await db.query(sql);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM quiz_fragen WHERE punkte_basis = 1")).rows[0].count, 0);
    await db.query("DELETE FROM quiz_praesentation_status WHERE quiz_id = 39");
    await db.query(sql);
    const withoutLifecycleBlock = await db.query("SELECT quiz_fragen_id FROM quiz_fragen WHERE punkte_basis = 1");
    assert.deepEqual(withoutLifecycleBlock.rows.map(row => row.quiz_fragen_id), [470]);
    await db.query("ROLLBACK TO SAVEPOINT before_fix");

    await db.query(sql);
    await db.query(sql);
    const updated = await db.query("SELECT quiz_fragen_id FROM quiz_fragen WHERE punkte_basis = 1 ORDER BY quiz_fragen_id");
    assert.deepEqual(updated.rows.map(row => row.quiz_fragen_id), [466, 469, 470]);
    const template = await db.query("SELECT basis_code, konfiguration_json FROM frage_vorlagen WHERE vorlage_id = 24");
    assert.deepEqual(template.rows[0], {
      basis_code: "musik",
      konfiguration_json: { version: 1, scoringTemplateId: "eight_bit", media: [{ slotKey: "music_original_audio" }] },
    });
    const history = await db.query("SELECT vergebene_punkte::text AS points FROM team_antworten ORDER BY quiz_fragen_id");
    assert.deepEqual(history.rows.map(row => row.points), ["0.5", "0.5"]);
  } finally {
    await db.query("ROLLBACK");
    await db.end();
  }
});
