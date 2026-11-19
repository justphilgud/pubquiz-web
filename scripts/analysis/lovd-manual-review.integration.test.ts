import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Client } from "pg";
import { analyzeManualReview, type ManualReviewAggregate } from "../../app/quiz/evaluation/manualReviewAnalysis";

const url = process.env.LOVD_AP5_TEST_DATABASE_URL;
test("real PostgreSQL: effective run/version, exact whole-payload equality, pending, unanswered and read-only aggregation", { skip: !url }, async () => {
  assert.ok(url);
  const database = new URL(url).pathname;
  assert.ok(database.startsWith("/lovd_november_review_") || (database === "/editorial_import_ci" && new URL(url).hostname === "127.0.0.1"), "isolated fixture database required");
  const db = new Client({ connectionString: url });
  await db.connect();
  const schema = `lovd_ap5_${Date.now()}`;
  try {
    await db.query("BEGIN");
    await db.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};
      CREATE TABLE quiz(quiz_id int,titel text,quiz_datum date);
      CREATE TABLE quiz_fragen(quiz_id int,quiz_fragen_id int,fragen_id int,sortierung int,quiz_abschnitt_id int,punkte_modus text,freie_antwort_erlaubt boolean);
      CREATE TABLE fragen(fragen_id int,vorlage_id int);
      CREATE TABLE frage_vorlagen(vorlage_id int,code text);
      CREATE TABLE frage_antwortfelder(fragen_id int,antwortfeld_id int);
      CREATE TABLE antworten(fragen_id int,ist_richtig boolean);
      CREATE TABLE quiz_interaction_runs(quiz_fragen_id int);
      CREATE TABLE quiz_team_sessions(quiz_id int,quiz_team_session_id int);
      CREATE TABLE team_antwortfelder(team_antwort_id int,antwortfeld_id int,antwort_text text);
      CREATE TABLE team_antworten(team_antwort_id int,quiz_fragen_id int,quiz_team_session_id int,interaction_run_id int,antwort_id int,antwort_text text,bewertungsstatus text,bewertungsquelle text,auto_basis_punkte numeric,auto_endpunkte numeric,vergebene_punkte numeric,bewertungs_version int,bewertungsdetails jsonb);
      CREATE TABLE team_answer_submissions(team_answer_submission_id int,team_antwort_id int,interaction_run_id int,submission_version int,interaction_type text,payload jsonb);
      INSERT INTO quiz VALUES(37,'Synthetic',current_date);
      INSERT INTO quiz_team_sessions SELECT 37,n FROM generate_series(1,6)n;
      INSERT INTO fragen VALUES(1,null),(2,null),(3,null);
      INSERT INTO antworten VALUES(1,true),(2,true),(3,true);
      INSERT INTO quiz_fragen VALUES(37,1,1,1,1,'standard',false),(37,2,2,2,1,'standard',false),(37,3,3,3,1,'standard',false);
      INSERT INTO quiz_interaction_runs VALUES(1),(3);
      INSERT INTO team_antworten SELECT n,1,n,10,null,'new unsent draft','CORRECT','MANUAL',0,0,1,3,'{}' FROM generate_series(1,4)n;
      INSERT INTO team_antworten VALUES(5,1,5,10,null,'draft only','CORRECT','AUTO',1,1,1,3,'{}');
      INSERT INTO team_antworten VALUES(6,1,6,10,null,'pending','REVIEW_REQUIRED','AUTO',null,null,null,2,null);
      INSERT INTO team_answer_submissions VALUES
      (1,1,10,1,'TEXT','{"text":"old"}'),(2,1,10,2,'TEXT','{"text":"same"}'),
      (3,1,99,9,'TEXT','{"text":"wrong run"}'),(4,2,10,1,'TEXT','{"text":"same"}'),
      (5,3,10,1,'TEXT','{"text":"Same"}'),(6,4,10,1,'TEXT','{"text":"same "}'),
      (7,6,10,1,'TEXT','{"text":"pending"}');`);
    await db.query(`INSERT INTO frage_antwortfelder VALUES(3,31),(3,32);
      INSERT INTO team_antworten VALUES(31,3,1,30,null,null,'CORRECT','MANUAL',0,0,1,3,'{}'),(32,3,2,30,null,null,'WRONG','MANUAL',0,0,0,3,'{}');
      INSERT INTO team_answer_submissions VALUES(31,31,30,1,'STRUCTURED_TEXT','{"fields":{"31":"A","32":"B"}}'),(32,32,30,1,'STRUCTURED_TEXT','{"fields":{"32":"B","31":"A"}}');`);
    const sql = readFileSync("scripts/analysis/lovd-manual-review.sql", "utf8").replaceAll("pubquiz.", `${schema}.`);
    assert.doesNotMatch(sql.replaceAll(/--[^\n]*/g, ""), /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|CALL)\b/i);
    const result = (await db.query<ManualReviewAggregate>(sql)).rows;
    const first = result.find(q => q.id === 1)!;
    assert.equal(first.answered, 5);
    assert.equal(first.unanswered, 1);
    assert.equal(first.unsubmitted_drafts, 1);
    assert.equal(first.pending, 1);
    assert.deepEqual(first.groups.map(g => g.members), [2, 1, 1, 1]);
    assert.equal(analyzeManualReview(result).totals.freeTextSavings, 1);
    assert.equal(analyzeManualReview(result).totals.conflicts, 1);
    assert.deepEqual(result.find(q => q.id === 3)!.groups, [{ members: 2, manualOrReview: 2, unresolved: 0, conflict: true }]);
    assert.equal(analyzeManualReview(result).totals.defaultVisible, 12);
    assert.equal((await db.query("SELECT count(*)::int n FROM team_answer_submissions")).rows[0].n, 9);
  } finally { await db.query("ROLLBACK"); await db.end(); }
});
