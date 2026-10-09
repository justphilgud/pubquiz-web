import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { Client } from "pg";
import { assertDatabase } from "./operations/guards";
import { parseEditorialPool, sha256 } from "../app/fragen/import/external/editorialImport";
import { editorialIntegritySnapshot } from "../app/fragen/import/external/editorialImportDatabase";

// Fixed source, fixed Preview identity, fixed read-only audit. No credentials or participant contents exported.
export async function auditEditorialQuestions(client: Client) {
  const hashes = { "anagrams.json": "dc0a2511690b0e4df4cd924dc6000b4d792f03ad95f87990dee24bd5f09cd4f0",
    "estimates.json": "3fc63c06afe83c47c8192f374eeb9206628bbd03dc322e01abf6b6b99008c89f" };
  const candidates = Object.entries(hashes).flatMap(([name, hash]) => {
    const raw = readFileSync(`editorial/paule-oktober-2026/${name}`, "utf8");
    if (sha256(raw) !== hash) throw new Error("SOURCE_CHANGED");
    return parseEditorialPool(name, raw);
  });
  const rows = (await client.query(`SELECT f.fragen_id AS id, f.frage, f.quelle, f.template_config_json,
    f.redaktionelle_schwierigkeit, f.review_status, f.freigegeben, f.ist_unfertig, v.code,
    i.external_reference, i.content_fingerprint, i.provider_payload_json,
    COALESCE((SELECT jsonb_agg(a.antwort ORDER BY a.antwort_id) FROM pubquiz.antworten a WHERE a.fragen_id=f.fragen_id AND a.ist_richtig),'[]') AS answers,
    COALESCE((SELECT jsonb_agg(k.kategorie ORDER BY k.kategorie) FROM pubquiz.fragen_kategorien fk JOIN pubquiz.fragenkategorie k USING(fragenkategorie_id) WHERE fk.fragen_id=f.fragen_id),'[]') AS categories
    FROM pubquiz.external_question_import_items i JOIN pubquiz.fragen f ON f.fragen_id=i.question_id
    JOIN pubquiz.frage_vorlagen v ON v.vorlage_id=f.vorlage_id WHERE i.provider='Editorial:PR93' ORDER BY f.fragen_id`)).rows;
  if (rows.length !== 79 || new Set(rows.map(r => r.id)).size !== 79) throw new Error("IMPORT_MANIFEST_CHANGED");
  const comparisons = rows.map(row => {
    const candidate = candidates.find(c => c.externalId === row.external_reference);
    if (!candidate || !isDeepStrictEqual(candidate, row.provider_payload_json.candidate)) throw new Error("JOURNAL_SOURCE_CHANGED");
    const expected = { frage: candidate.question, quelle: candidate.sources.join("\n"),
      template_config_json: candidate.templateConfig, redaktionelle_schwierigkeit: candidate.difficulty,
      code: candidate.templateId, answers: [...new Set([candidate.solution, ...candidate.variants])].sort(),
      categories: [...candidate.categories].sort(), ist_unfertig: false };
    const observed = { ...expected, frage: row.frage, quelle: row.quelle, template_config_json: row.template_config_json,
      redaktionelle_schwierigkeit: row.redaktionelle_schwierigkeit, code: row.code,
      answers: row.answers.sort(), categories: row.categories.sort(), ist_unfertig: row.ist_unfertig };
    const differences = Object.keys(expected).filter(key => !isDeepStrictEqual(expected[key as keyof typeof expected], observed[key as keyof typeof observed]))
      .map(field => ({ field, expected: expected[field as keyof typeof expected], observed: observed[field as keyof typeof observed] }));
    return { id: row.id as number, externalId: row.external_reference as string, template: row.code as string,
      reviewStatus: row.review_status as string, approved: row.freigegeben as boolean, differences };
  });
  const legacySnapshot = await editorialIntegritySnapshot(client, rows.map(r => r.id));
  const manifests = (await client.query(`SELECT report_json FROM pubquiz.external_question_import_batches
    WHERE provider='Editorial:PR93' AND status='COMPLETED' ORDER BY import_batch_id`)).rows;
  if (manifests.length !== 1) throw new Error("BATCH_MANIFEST_CHANGED");
  const originalBefore = manifests[0].report_json.before;
  const legacyQuestionsUnchanged = ["fragen", "antworten", "fragen_kategorien"].every(table =>
    isDeepStrictEqual(legacySnapshot[table], originalBefore[table]));
  return { count: rows.length, comparisons, legacyQuestionsUnchanged, legacySnapshot,
    currentSnapshot: await editorialIntegritySnapshot(client), originalBefore };
}

async function main() {
  if (process.env.CI !== "true" || process.env.DEPLOYMENT_ENV !== "preview" ||
      process.env.DEPLOYMENT_REF !== "refs/heads/codex/editorial-safe-import") throw new Error("PREVIEW_AUDIT_REQUIRED");
  assertDatabase(process.env.DATABASE_URL, "preview");
  const url = new URL(process.env.DATABASE_URL!); url.searchParams.delete("schema");
  const client = new Client({ connectionString: url.toString() }); await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='30s'");
    const result = await auditEditorialQuestions(client);
    await client.query("ROLLBACK");
    writeFileSync("editorial-integrity-audit.json", JSON.stringify(result, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ count: result.count, divergentQuestions: result.comparisons.filter(r => r.differences.length).map(r => r.id),
      legacyQuestionsUnchanged: result.legacyQuestionsUnchanged, readOnly: true }));
  } finally { await client.end(); }
}
if (process.argv[1]?.endsWith("editorial-import-audit.ts")) main().catch(() => {
  console.error("EDITORIAL_AUDIT_FAILED_DETAILS_WITHHELD"); process.exitCode = 1;
});
