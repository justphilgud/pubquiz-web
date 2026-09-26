import { Client } from "pg";

import {
  preflightExternalImport,
  type ExistingExternalQuestion,
  type ExternalImportPlan,
  type ProductionIdentity,
} from "../../app/fragen/import/external/productionImportGuard";
import { assertDatabase, assertOperationTransport } from "../operations/guards";

type QuestionRow = {
  question_id: number;
  question: string;
  correct_answer: string | null;
  source_type: string | null;
  external_reference: string | null;
  content_fingerprint: string | null;
};

export async function readProductionExternalImportPreflight(input: {
  connectionString: string;
  plan: ExternalImportPlan;
}) {
  const identity = assertDatabase(input.connectionString, "production");
  assertOperationTransport(new URL(input.connectionString));
  const client = new Client({ connectionString: input.connectionString });
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL search_path=pg_catalog");
    const session = await client.query<{
      role: string;
      database: string;
      read_only: string;
    }>("SELECT current_user AS role, current_database() AS database, current_setting('transaction_read_only') AS read_only");
    if (session.rows[0]?.database !== identity.name || session.rows[0]?.read_only !== "on") {
      throw new Error("EXTERNAL_IMPORT_PREFLIGHT_SESSION_INVALID");
    }
    const rows = await client.query<QuestionRow>(`
      SELECT
        f.fragen_id AS question_id,
        f.frage AS question,
        (
          SELECT a.antwort
          FROM pubquiz.antworten a
          WHERE a.fragen_id = f.fragen_id AND a.ist_richtig = true
          ORDER BY a.antwort_id
          LIMIT 1
        ) AS correct_answer,
        i.provider AS source_type,
        i.external_reference,
        i.content_fingerprint
      FROM pubquiz.fragen f
      LEFT JOIN pubquiz.external_question_import_items i
        ON i.question_id = f.fragen_id
      WHERE f.ist_archiviert = false
      ORDER BY f.fragen_id
    `);
    const orphanMappings = await client.query<QuestionRow>(`
      SELECT
        0 AS question_id,
        i.original_question AS question,
        i.original_correct_answer AS correct_answer,
        i.provider AS source_type,
        i.external_reference,
        i.content_fingerprint
      FROM pubquiz.external_question_import_items i
      WHERE i.question_id IS NULL
      ORDER BY i.import_item_id
    `);
    const existing = [...rows.rows, ...orphanMappings.rows].map<ExistingExternalQuestion>((row) => ({
      questionId: row.question_id,
      question: row.question,
      correctAnswer: row.correct_answer,
      sourceType: row.source_type,
      externalReference: row.external_reference,
      contentFingerprint: row.content_fingerprint,
    }));
    const preflight = preflightExternalImport(input.plan, existing);
    await client.query("ROLLBACK");
    const safeIdentity: ProductionIdentity = {
      host: identity.host,
      database: identity.name,
      schema: identity.schema,
    };
    return {
      identity: safeIdentity,
      role: session.rows[0].role,
      questionCount: existing.length,
      preflight,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original safe error is more useful than a secondary rollback error.
    }
    throw error;
  } finally {
    await client.end();
  }
}
