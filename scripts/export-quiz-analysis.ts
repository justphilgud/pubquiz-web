import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { readQuizAnalysis } from "../app/quiz/analysis/quizAnalysisReader";
import { summarizeQuestionInventory } from "../app/quiz/analysis/questionInventory";

async function main() {
  const connectionString = process.env.ANALYSIS_DATABASE_URL;
  const expectedHost = process.env.ANALYSIS_EXPECTED_DATABASE_HOST;
  const output = process.argv[2];
  if (!connectionString || !expectedHost || !output) throw new Error("ANALYSIS_CONFIGURATION_REQUIRED");
  if (new URL(connectionString).hostname !== expectedHost) throw new Error("ANALYSIS_DATABASE_IDENTITY_MISMATCH");
  const client = new Client({ connectionString, options: "-c default_transaction_read_only=on" });
  try {
    await client.connect();
    const snapshot = await readQuizAnalysis(client);
    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    await writeFile(output, JSON.stringify(snapshot, null, 2));
    await writeFile(`${output}.inventory.json`, JSON.stringify(summarizeQuestionInventory(snapshot), null, 2));
    console.log(JSON.stringify({ readOnly: true, capturedAt: snapshot.capturedAt,
      questions: snapshot.questions.length, quizzes: snapshot.quizzes.length,
      templates: snapshot.templates.length, output: path.resolve(output) }));
  } finally { await client.end(); }
}

main().catch(() => { console.error("ANALYSIS_EXPORT_FAILED (connection details suppressed)"); process.exitCode = 1; });
