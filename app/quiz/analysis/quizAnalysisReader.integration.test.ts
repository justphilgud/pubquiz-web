import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "pg";
import { readQuizAnalysis } from "./quizAnalysisReader";

const connectionString = process.env.QUIZ_ANALYSIS_TEST_DATABASE_URL;
test("development database: complete snapshot leaves editorial and runtime rows unchanged", {
  skip: !connectionString,
}, async () => {
  assert.notEqual(new URL(connectionString!).hostname, "ep-dawn-paper-alws45vx-pooler.c-3.eu-central-1.aws.neon.tech",
    "This integration test must not run on Production");
  const client = new Client({ connectionString, options: "-c default_transaction_read_only=on" });
  const checksums = async () => {
    const result = await client.query(`SELECT
      (SELECT md5(COALESCE(string_agg(to_jsonb(q)::text,'|' ORDER BY fragen_id),'')) FROM pubquiz.fragen q) AS questions,
      (SELECT md5(COALESCE(string_agg(to_jsonb(q)::text,'|' ORDER BY quiz_id),'')) FROM pubquiz.quiz q) AS quizzes,
      (SELECT md5(COALESCE(string_agg(to_jsonb(q)::text,'|' ORDER BY quiz_fragen_id),'')) FROM pubquiz.quiz_fragen q) AS assignments,
      (SELECT count(*)::text FROM pubquiz.quiz_interaction_runs) AS runs,
      (SELECT count(*)::text FROM pubquiz.quiz_praesentation_status) AS presentation_states`);
    return result.rows[0];
  };
  try {
    await client.connect();
    const before = await checksums();
    const snapshot = await readQuizAnalysis(client);
    assert.ok(snapshot.questions.length > 0);
    assert.deepEqual(await checksums(), before);
    await client.query("BEGIN READ ONLY");
    await assert.rejects(client.query("UPDATE pubquiz.fragen SET frage=frage WHERE FALSE"), { code: "25006" });
    await client.query("ROLLBACK");
    console.log(`Read-only integration: ${snapshot.questions.length} questions, ${snapshot.quizzes.length} quizzes; editorial hashes and runtime counts unchanged.`);
  } finally { await client.end(); }
});
