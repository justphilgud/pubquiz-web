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
