import { Client } from "pg";
import { isDeepStrictEqual } from "node:util";
import { assertDatabase } from "../../../../scripts/operations/guards";
import { candidateDigest, previewEditorialImport, sha256, type EditorialSource, type EditorialExistingQuestion } from "./editorialImport";

// Fixed application-table allowlist: neither identifiers nor SQL are caller-configurable.
const PROTECTED_TABLES = [
  "fragen", "antworten", "antworttyp", "fragen_kategorien", "fragen_relationen", "fragenkategorie",
  "medien", "medientyp", "medien_generator_laefe", "medien_generator_lauf_medien",
  "frage_antwortfelder", "frage_antwortfeld_loesungen", "fragen_eventreihen", "frage_story_elemente",
  "frage_vorlagen", "frage_vorlage_antwortfelder", "public_question_submissions", "public_question_rate_limits",
  "quiz", "eventreihen", "quiz_fragen", "quiz_abschnitte", "quiz_ablauf_elemente", "quiz_block_freigaben",
  "quiz_praesentation_status", "quiz_interaction_runs", "quiz_team_sessions", "quiz_teams", "teams",
  "team_antworten", "team_antwort_auswahlen", "team_antwortfelder", "team_answer_submissions",
  "presentation_templates", "story_elemente", "story_element_revisionen", "live_polls", "live_poll_revisions",
  "live_poll_responses", "meme_moderation_selections", "meme_moderation_candidates", "meme_presentations",
  "meme_result_entries", "meme_votes", "live_text_response_publications", "public_text_replacement_rules",
  "users", "benutzer_rollenzuweisungen", "eventreihe_benutzerrollen",
] as const;
type Integrity = Record<string, { count: number; digest: string }>;
export type EditorialDatabaseInput = { connectionString: string; source: EditorialSource; operatorUserId: number; mode: "dry-run" | "import"; expectedDryRunDigest?: string };

async function snapshot(client: Client, exclude: number[] = []): Promise<Integrity> {
  const result: Integrity = {};
  for (const table of PROTECTED_TABLES) {
    // Table identifiers come exclusively from the constant allowlist above.
    const where = table === "fragen" ? "WHERE NOT (t.fragen_id = ANY($1::int[]))"
      : ["antworten", "fragen_kategorien"].includes(table) ? "WHERE NOT (t.fragen_id = ANY($1::int[]))" : "";
    const sql = `SELECT count(*)::int AS count, md5(COALESCE(string_agg(to_jsonb(t)::text, '\n' ORDER BY to_jsonb(t)::text), '')) AS digest FROM pubquiz.${table} t ${where}`;
    result[table] = (await client.query(sql, where ? [exclude] : [])).rows[0];
  }
  const counts = await client.query(`SELECT COALESCE(v.code,'standard') AS code, count(*)::int AS count
    FROM pubquiz.fragen f LEFT JOIN pubquiz.frage_vorlagen v ON v.vorlage_id=f.vorlage_id
    WHERE NOT (f.fragen_id=ANY($1::int[])) GROUP BY COALESCE(v.code,'standard') ORDER BY code`, [exclude]);
  for (const row of counts.rows) result[`template:${row.code}`] = { count: row.count, digest: String(row.count) };
  return result;
}
async function inventory(client: Client, source: EditorialSource) {
  const questions = await client.query(`SELECT f.fragen_id AS id, f.frage AS question, v.code AS "templateId",
    COALESCE((SELECT jsonb_agg(a.antwort ORDER BY a.antwort_id) FROM pubquiz.antworten a WHERE a.fragen_id=f.fragen_id AND a.ist_richtig), '[]'::jsonb) AS solutions,
    f.template_config_json->'templateData' AS "templateData", i.provider_payload_json->'candidate'->'metadata' AS metadata
    FROM pubquiz.fragen f LEFT JOIN pubquiz.frage_vorlagen v ON v.vorlage_id=f.vorlage_id
    LEFT JOIN pubquiz.external_question_import_items i ON i.question_id=f.fragen_id ORDER BY f.fragen_id`);
  const previous = await client.query(`SELECT external_reference, question_id, content_fingerprint FROM pubquiz.external_question_import_items WHERE provider=$1 ORDER BY import_item_id`, [source.provider]);
  const categories = await client.query(`SELECT fragenkategorie_id AS id, kategorie AS name FROM pubquiz.fragenkategorie WHERE status='ACTIVE' ORDER BY fragenkategorie_id`);
  const decisions = previewEditorialImport(source, questions.rows as EditorialExistingQuestion[], new Map(previous.rows.map(r => [r.external_reference, { questionId: r.question_id, digest: r.content_fingerprint }])), new Set(categories.rows.map(r => r.name)));
  const digest = sha256(JSON.stringify({ source, decisions, existing: questions.rows, previous: previous.rows, categories: categories.rows }));
  return { decisions, digest, categories: categories.rows as { id: number; name: string }[] };
}

async function journalSnapshot(client: Client, excludedBatch = -1): Promise<Integrity> {
  const result: Integrity = {};
  for (const table of ["external_question_import_batches", "external_question_import_items"] as const) {
    result[table] = (await client.query(`SELECT count(*)::int AS count,
      md5(COALESCE(string_agg(to_jsonb(t)::text, '\n' ORDER BY to_jsonb(t)::text), '')) AS digest
      FROM pubquiz.${table} t WHERE import_batch_id <> $1`, [excludedBatch])).rows[0];
  }
  return result;
}

/** Fixed-query, Preview-only adapter; authenticated server wrapper supplies the operator. */
export async function runEditorialDatabaseImport(input: EditorialDatabaseInput) {
  const identity = new URL(input.connectionString);
  const isolatedCi = process.env.CI === "true" && identity.hostname === "127.0.0.1" && identity.pathname === "/editorial_import_ci";
  if (!isolatedCi) assertDatabase(input.connectionString, "preview");
  if (!Number.isSafeInteger(input.operatorUserId) || input.operatorUserId <= 0) throw new Error("EDITORIAL_OPERATOR_REQUIRED");
  const url = new URL(input.connectionString); url.searchParams.delete("schema");
  const client = new Client({ connectionString: url.toString() });
  let begun = false;
  try {
    await client.connect();
    await client.query(input.mode === "dry-run" ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN"); begun = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    if (input.mode === "dry-run") {
      const setting = (await client.query("SHOW transaction_read_only")).rows[0];
      if (setting.transaction_read_only !== "on") throw new Error("EDITORIAL_READ_ONLY_REQUIRED");
    } else {
      await client.query("SELECT pg_advisory_xact_lock(18431008)");
      await client.query(`LOCK TABLE ${PROTECTED_TABLES.map(t => `pubquiz.${t}`).join(", ")}, pubquiz.external_question_import_batches, pubquiz.external_question_import_items IN SHARE ROW EXCLUSIVE MODE`);
    }
    const before = await snapshot(client);
    const journalBefore = await journalSnapshot(client);
    const preview = await inventory(client, input.source);
    if (input.mode === "dry-run") {
      await client.query("ROLLBACK"); begun = false;
      return { mode: input.mode, ...preview, before, after: before, questionIds: [], manifest: null };
    }
    if (preview.digest !== input.expectedDryRunDigest) throw new Error("EDITORIAL_DRY_RUN_STALE");
    const templates = (await client.query("SELECT vorlage_id AS id, code FROM pubquiz.frage_vorlagen WHERE code IN ('anagramm','schaetzfrage')")).rows as { id: number; code: string }[];
    const answerType = (await client.query("SELECT antworttyp_id AS id FROM pubquiz.antworttyp WHERE lower(antworttyp)='standard'")).rows[0];
    if (!answerType) throw new Error("EDITORIAL_ANSWER_TYPE_MISSING");
    const batch = (await client.query(`INSERT INTO pubquiz.external_question_import_batches(provider, requested_count, fetched_count, status, created_by_user_id)
      VALUES($1,$2,$2,'PROCESSING',$3) RETURNING import_batch_id`, [input.source.provider, input.source.candidates.length, input.operatorUserId])).rows[0].import_batch_id as number;
    const items: { externalId: string; questionId: number | null; action: string; reasons: unknown }[] = [];
    const questionIds: number[] = [];
    for (const decision of preview.decisions) {
      const c = decision.candidate;
      if (decision.action !== "IMPORTIEREN") {
        const sourceDuplicate = decision.duplicates.find(d => d.questionId < 0 && ["IDENTICAL_QUESTION", "SAME_ANAGRAM"].includes(d.reason));
        const priorSourceId = sourceDuplicate ? input.source.candidates[-sourceDuplicate.questionId - 1]?.externalId : undefined;
        const resolvedId = decision.existingQuestionId ?? items.find(i => i.externalId === priorSourceId)?.questionId ?? null;
        items.push({ externalId: c.externalId, questionId: resolvedId, action: decision.action, reasons: { validation: decision.validation, duplicates: decision.duplicates } }); continue;
      }
      const template = templates.find(t => t.code === c.templateId);
      if (!template) throw new Error("EDITORIAL_TEMPLATE_NOT_MIGRATED");
      const questionId = (await client.query(`INSERT INTO pubquiz.fragen(frage, quelle, vorlage_id, template_config_json, redaktionelle_schwierigkeit,
        created_by_user_id, last_modified_by_user_id, freigegeben, review_status, ist_unfertig)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,$6,false,'DRAFT',false) RETURNING fragen_id`,
      [c.question, c.sources.join("\n"), template.id, JSON.stringify(c.templateConfig), c.difficulty, input.operatorUserId])).rows[0].fragen_id as number;
      questionIds.push(questionId);
      for (const answer of [...new Set([c.solution, ...c.variants])]) await client.query(`INSERT INTO pubquiz.antworten(fragen_id,antwort,ist_richtig,antworttyp_id) VALUES($1,$2,true,$3)`, [questionId, answer, answerType.id]);
      for (const category of c.categories) {
        const id = preview.categories.find(r => r.name === category)?.id;
        if (!id) throw new Error("EDITORIAL_CATEGORY_CHANGED");
        await client.query(`INSERT INTO pubquiz.fragen_kategorien(fragen_id,fragenkategorie_id) VALUES($1,$2)`, [questionId, id]);
      }
      await client.query(`INSERT INTO pubquiz.external_question_import_items(import_batch_id,provider,external_reference,license,license_url,
        original_language,original_category,original_difficulty,original_type,original_question,original_correct_answer,original_incorrect_answers,
        provider_payload_json,content_fingerprint,question_id,status)
        VALUES($1,$2,$3,'Owner-approved editorial source','', 'de',$4,$5,$6,$7,$8,'[]'::jsonb,$9::jsonb,$10,$11,'IMPORTED')`,
      [batch,input.source.provider,c.externalId,c.categories.join(" / "),c.difficulty,c.templateId,c.question,c.solution,JSON.stringify({ source: input.source.files, candidate: c }),candidateDigest(c),questionId]);
      items.push({ externalId: c.externalId, questionId, action: "IMPORTIERT", reasons: [] });
    }
    const afterProtected = await snapshot(client, questionIds);
    if (JSON.stringify(before) !== JSON.stringify(afterProtected)) throw new Error("EDITORIAL_INTEGRITY_CHANGED");
    const after = await snapshot(client);
    if (after.fragen.count !== before.fragen.count + questionIds.length) throw new Error("EDITORIAL_COUNT_MISMATCH");
    const expectedAnswers = preview.decisions.filter(d => d.action === "IMPORTIEREN").reduce((n,d) => n + new Set([d.candidate.solution,...d.candidate.variants]).size,0);
    const expectedCategories = preview.decisions.filter(d => d.action === "IMPORTIEREN").reduce((n,d) => n + d.candidate.categories.length,0);
    if (after.antworten.count !== before.antworten.count + expectedAnswers || after.fragen_kategorien.count !== before.fragen_kategorien.count + expectedCategories) throw new Error("EDITORIAL_RELATION_COUNT_MISMATCH");
    const manifest = { version: 1, provider: input.source.provider, files: input.source.files, batchId: batch, dryRunDigest: preview.digest, before, after, journalBefore, existingJournalUnchanged: true, items, reviewStatus: "DRAFT", approved: false };
    await client.query("UPDATE pubquiz.external_question_import_batches SET status='COMPLETED', completed_at=now(), report_json=$1::jsonb WHERE import_batch_id=$2", [JSON.stringify(manifest),batch]);
    // Check actual persisted rows, including changes introduced by database triggers.
    for (const item of items.filter(i => i.action === "IMPORTIERT")) {
      const candidate = input.source.candidates.find(c => c.externalId === item.externalId)!;
      const persisted = (await client.query(`SELECT f.frage, f.quelle, f.template_config_json,
        f.redaktionelle_schwierigkeit, f.freigegeben, f.review_status, v.code,
        (SELECT jsonb_agg(a.antwort ORDER BY a.antwort) FROM pubquiz.antworten a WHERE a.fragen_id=f.fragen_id AND a.ist_richtig) AS answers,
        (SELECT jsonb_agg(k.kategorie ORDER BY k.kategorie) FROM pubquiz.fragen_kategorien fk JOIN pubquiz.fragenkategorie k USING(fragenkategorie_id) WHERE fk.fragen_id=f.fragen_id) AS categories,
        i.content_fingerprint, i.provider_payload_json
        FROM pubquiz.fragen f JOIN pubquiz.frage_vorlagen v ON v.vorlage_id=f.vorlage_id
        JOIN pubquiz.external_question_import_items i ON i.question_id=f.fragen_id
        WHERE f.fragen_id=$1 AND i.import_batch_id=$2 AND i.external_reference=$3 AND i.provider=$4`,
      [item.questionId,batch,item.externalId,input.source.provider])).rows[0];
      if (!persisted || persisted.frage !== candidate.question || persisted.quelle !== candidate.sources.join("\n")
        || persisted.redaktionelle_schwierigkeit !== candidate.difficulty || persisted.freigegeben !== false
        || persisted.review_status !== "DRAFT" || persisted.code !== candidate.templateId
        || !isDeepStrictEqual(persisted.provider_payload_json.candidate, candidate)
        || persisted.content_fingerprint !== candidateDigest(candidate)
        || !isDeepStrictEqual(persisted.template_config_json, candidate.templateConfig)
        || JSON.stringify(persisted.answers.sort()) !== JSON.stringify([...new Set([candidate.solution,...candidate.variants])].sort())
        || JSON.stringify(persisted.categories.sort()) !== JSON.stringify([...candidate.categories].sort())) throw new Error("EDITORIAL_PERSISTED_CONTENT_MISMATCH");
    }
    if (JSON.stringify(before) !== JSON.stringify(await snapshot(client, questionIds))) throw new Error("EDITORIAL_INTEGRITY_CHANGED");
    if (!isDeepStrictEqual(journalBefore, await journalSnapshot(client, batch))) throw new Error("EDITORIAL_JOURNAL_INTEGRITY_CHANGED");
    const journalAfter = await journalSnapshot(client);
    if (journalAfter.external_question_import_batches.count !== journalBefore.external_question_import_batches.count + 1
      || journalAfter.external_question_import_items.count !== journalBefore.external_question_import_items.count + questionIds.length) throw new Error("EDITORIAL_JOURNAL_COUNT_MISMATCH");
    await client.query("COMMIT"); begun = false;
    return { mode: input.mode, ...preview, before, after, questionIds, manifest };
  } finally {
    if (begun) await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
}
