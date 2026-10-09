import { writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import type { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../app/generated/prisma/client";
import { assertDatabase } from "./operations/guards";
import { isAdministrator } from "../app/roles/roleAssignmentPolicy";
import { transitionStoredQuestionStatus } from "../app/fragen/editor/questionStatusPersistence";
import { editorialIntegritySnapshot, PROTECTED_TABLES } from "../app/fragen/import/external/editorialImportDatabase";
import { auditEditorialQuestions } from "./editorial-import-audit";

/** Only the observed editor transformation is repairable; any other change blocks. */
export function assertRepairableConfig(id: number, expected: unknown, observed: unknown) {
  const config = expected as { templateData: { kind: string; selectedSolution?: string; suggestions?: string[] } };
  const transformed = structuredClone(config);
  if (id === 154 && transformed.templateData.kind === "ANAGRAM") {
    transformed.templateData.selectedSolution = transformed.templateData.selectedSolution?.toLocaleUpperCase("de-DE");
    transformed.templateData.suggestions = transformed.templateData.suggestions?.map(value => value.toLocaleUpperCase("de-DE"));
  } else if (id !== 207 || transformed.templateData.kind !== "ESTIMATE") throw new Error("REPAIR_TARGET_INVALID");
  const expanded = { ...transformed, stageDurationsSeconds: { stage1: 15, stage2: 15, stage3: 15 },
    createPixelQuestionByAnswer: { answer1: false, answer2: false } };
  if (!isDeepStrictEqual(observed, expected) && !isDeepStrictEqual(observed, expanded)) throw new Error("UNEXPECTED_CONTENT_CHANGED");
}

// Bridge for the existing fixed SELECT-only auditor, using this SAME Prisma transaction.
function auditClient(tx: Prisma.TransactionClient): Client {
  return { query: async (sql: string, values: unknown[] = []) => {
    if (!sql.trimStart().startsWith("SELECT ")) throw new Error("AUDIT_NOT_READ_ONLY");
    const rows = await tx.$queryRawUnsafe<unknown[]>(sql, ...values);
    return { rows };
  } } as unknown as Client;
}

export async function repairEditorialTestQuestions(db: PrismaClient) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout='5s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout='30s'");
    // Fixed table list from the existing auditor. Lock before reading to exclude concurrent writers.
    await tx.$executeRawUnsafe(`LOCK TABLE ${PROTECTED_TABLES.map(name => `pubquiz.${name}`).join(", ")}, pubquiz.external_question_import_batches, pubquiz.external_question_import_items IN SHARE ROW EXCLUSIVE MODE`);
    const before = await auditEditorialQuestions(auditClient(tx));
    if (!before.legacyQuestionsUnchanged || before.comparisons.some(row =>
      ![154,207].includes(row.id) && (row.differences.length || row.approved || row.reviewStatus !== "DRAFT"))) throw new Error("BASELINE_CHANGED");
    const batch = await tx.external_question_import_batches.findFirst({ where: { provider: "Editorial:PR93", status: "COMPLETED" }, select: { created_by_user_id: true } });
    if (!batch?.created_by_user_id) throw new Error("IMPORT_OPERATOR_MISSING");
    const assignments = await tx.benutzer_rollenzuweisungen.findMany({ where: {
      benutzer_id: batch.created_by_user_id, benutzer: { is_active: true } }, select: { rolle: true, scope_typ: true, eventreihe_id: true } });
    const actor = { userId: batch.created_by_user_id, assignments: assignments.map(row => ({ role: row.rolle, scopeType: row.scope_typ, eventSeriesId: row.eventreihe_id })) };
    if (!isAdministrator(actor)) throw new Error("IMPORT_OPERATOR_NO_LONGER_ADMIN");
    const otherQuestionsBefore = (await editorialIntegritySnapshot(auditClient(tx),[154,207])).fragen;
    const journal = async () => (await tx.$queryRawUnsafe(`SELECT 'batches' AS kind, count(*)::int AS count, md5(string_agg(to_jsonb(t)::text,'\n' ORDER BY to_jsonb(t)::text)) AS digest FROM pubquiz.external_question_import_batches t
      UNION ALL SELECT 'items', count(*)::int, md5(string_agg(to_jsonb(t)::text,'\n' ORDER BY to_jsonb(t)::text)) FROM pubquiz.external_question_import_items t ORDER BY kind`));
    const journalBefore = await journal();
    const changes: { id: number; configRestored: boolean; statusChanged: boolean }[] = [];
    for (const id of [154,207]) {
      const comparison = before.comparisons.find(row => row.id === id);
      if (!comparison || comparison.externalId !== (id === 154 ? "ANA-01" : "EST-09") ||
          comparison.differences.some(diff => diff.field !== "template_config_json")) throw new Error("REPAIR_TARGET_CHANGED");
      const original = await tx.fragen.findUniqueOrThrow({ where: { fragen_id: id } });
      const item = await tx.external_question_import_items.findFirstOrThrow({ where: { question_id: id, provider: "Editorial:PR93" }, select: { provider_payload_json: true } });
      const expected = (item.provider_payload_json as { candidate: { templateConfig: Prisma.InputJsonValue } }).candidate.templateConfig;
      assertRepairableConfig(id, expected, original.template_config_json);
      const configRestored = !isDeepStrictEqual(expected, original.template_config_json);
      if (configRestored) await tx.fragen.update({ where: { fragen_id: id }, data: { template_config_json: expected } });
      const current = await tx.fragen.findUniqueOrThrow({ where: { fragen_id: id } });
      const statusChanged = current.review_status !== "DRAFT" || current.freigegeben;
      if (statusChanged) await transitionStoredQuestionStatus(tx,actor,{ questionId:id,target:"DRAFT",expectedUpdatedAt:current.updated_at.toISOString() },async()=>{ throw new Error("REPAIR_MUST_NOT_APPROVE"); });
      const afterRow = await tx.fragen.findUniqueOrThrow({ where: { fragen_id: id } });
      // The only permitted row differences are the original config and status/audit metadata.
      const allowed = new Set(["template_config_json","review_status","freigegeben","approved_at","approved_by_user_id","reviewed_at","reviewed_by_user_id","review_feedback","last_modified_by_user_id","updated_at"]);
      for (const key of Object.keys(original) as (keyof typeof original)[]) if (!allowed.has(key) && !isDeepStrictEqual(original[key],afterRow[key])) throw new Error("UNAUTHORIZED_ROW_CHANGE");
      changes.push({ id, configRestored, statusChanged });
    }
    const after = await auditEditorialQuestions(auditClient(tx));
    if (!after.legacyQuestionsUnchanged || after.comparisons.some(row => row.differences.length || row.approved || row.reviewStatus !== "DRAFT")) throw new Error("POSTFLIGHT_CONTENT_CHANGED");
    for (const table of Object.keys(before.currentSnapshot)) if (table !== "fragen" &&
      !isDeepStrictEqual(before.currentSnapshot[table],after.currentSnapshot[table])) throw new Error("PROTECTED_TABLE_CHANGED");
    if (!isDeepStrictEqual(otherQuestionsBefore,(await editorialIntegritySnapshot(auditClient(tx),[154,207])).fragen) ||
        !isDeepStrictEqual(journalBefore,await journal())) throw new Error("PROTECTED_QUESTIONS_OR_JOURNAL_CHANGED");
    return { changes, before, after, protectedTablesUnchanged: true, otherQuestionsUnchanged: true, importJournalUnchanged: true };
  }, { isolationLevel: "Serializable", timeout: 60000 });
}

async function main() {
  if (process.env.CI !== "true" || process.env.DEPLOYMENT_ENV !== "preview" ||
      process.env.DEPLOYMENT_REF !== "refs/heads/codex/editorial-safe-import" ||
      process.env.DEPLOYMENT_REPOSITORY !== "justphilgud/pubquiz-web" ||
      process.env.DEPLOYMENT_SHA !== process.env.GITHUB_SHA) throw new Error("REPAIR_CONTEXT_INVALID");
  assertDatabase(process.env.DATABASE_URL,"preview");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const result = await repairEditorialTestQuestions(db);
    writeFileSync("editorial-test-question-repair.json",JSON.stringify({ sha:process.env.DEPLOYMENT_SHA,...result },null,2),{flag:"wx"});
    console.log(JSON.stringify({ questions:result.after.count, changes:result.changes, protectedTablesUnchanged:true }));
  } finally { await db.$disconnect(); }
}
if (process.argv[1]?.endsWith("editorial-test-question-repair.ts")) main().catch(() => {
  console.error("EDITORIAL_TEST_QUESTION_REPAIR_FAILED_DETAILS_WITHHELD"); process.exitCode=1;
});
