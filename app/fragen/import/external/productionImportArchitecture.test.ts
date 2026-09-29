import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Preview UI exposes safe guard state without a Production writer", () => {
  const page = read("app/admin/question-import/page.tsx");
  assert.match(page, /Production-Import gesperrt/);
  assert.match(page, /writeAuthorized/);
  assert.match(page, /Eingefrorenen Plan exportieren/);
  assert.doesNotMatch(page, /PRODUCTION_IMPORT_DATABASE_URL/);
});

test("Production UI is explicitly read-only and exposes no import actions", () => {
  const page = read("app/admin/question-import/page.tsx");
  const start = page.indexOf('if (getLogicalEnvironment() === "production")');
  const end = page.indexOf("const totalPages");
  assert.ok(start >= 0 && end > start, "Production read-only branch missing");
  const productionBranch = page.slice(start, end);
  assert.match(productionBranch, /Externe Fragen · Production/);
  assert.match(productionBranch, /Read-only Production-Basis/);
  assert.match(productionBranch, /writeAuthorized = false/);
  assert.doesNotMatch(productionBranch, /<form|<button/);
  assert.doesNotMatch(productionBranch, /startOpenTdbPilotAction/);
});

test("Production preflight is structurally read-only", () => {
  const adapter = read("scripts/external-import/production-preflight.ts");
  assert.match(adapter, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(adapter, /ROLLBACK/);
  assert.doesNotMatch(adapter, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
});

test("Operations workflow uses the existing reader environment and has no write secret", () => {
  const workflow = read(".github/workflows/external-question-import-preflight.yml");
  assert.match(workflow, /environment: operations-backup/);
  assert.match(workflow, /PRODUCTION_BACKUP_DATABASE_URL/);
  assert.match(workflow, /productionChanged/);
  assert.match(workflow, /writeAuthorized: false/);
  assert.doesNotMatch(workflow, /PRODUCTION_IMPORT_DATABASE_URL/);
  assert.doesNotMatch(workflow, /operations-content-import/);
});

test("existing staging mutations retain the Preview-only assertion", () => {
  const service = read("app/fragen/import/external/externalQuestionImport.server.ts");
  for (const name of [
    "startOpenTdbPilot",
    "processOpenTdbPhaseTwo",
    "startExternalQuestionReview",
    "saveExternalQuestionPreparation",
    "approveExternalQuestion",
    "rejectExternalQuestion",
  ]) {
    const start = service.indexOf(`export async function ${name}`);
    assert.ok(start >= 0, `${name} missing`);
    assert.match(service.slice(start, start + 500), /assertOpenTdbPilotEnvironment\(\)/);
  }
});

test("Production writer has a single protected server-side entry path", () => {
  const workflow = read(".github/workflows/external-question-import.yml");
  const writer = read("scripts/external-import/production-writer.ts");
  const core = read("app/fragen/import/external/productionImportWriter.ts");
  assert.match(workflow, /environment: operations-backup/);
  assert.match(workflow, /environment: operations-content-import/);
  assert.ok(
    workflow.indexOf("environment: operations-backup") <
      workflow.indexOf("environment: operations-content-import"),
  );
  assert.match(workflow, /PRODUCTION_IMPORT_DATABASE_URL/);
  assert.match(workflow, /inputs\.dry_run == false/);
  assert.match(writer, /evaluateExternalImportGuard/);
  assert.match(writer, /guard\.writeAuthorized/);
  assert.match(writer, /fetchVerifiedExternalImportReviewerApproval/);
  assert.match(writer, /EXTERNAL_IMPORT_TOCTOU_PREFLIGHT_CHANGED/);
  assert.match(writer, /verifyBatchUpdateExecution/);
  for (const column of ["status", "report_json", "error_message", "completed_at"]) {
    assert.match(
      writer,
      new RegExp(`SET ${column} = ${column}\\s+WHERE FALSE`),
    );
  }
  assert.match(
    writer,
    /EXTERNAL_IMPORT_WRITER_BATCH_COMBINED_UPDATE_EXECUTION_FAILED/,
  );
  assert.match(writer, /EXTERNAL_IMPORT_WRITER_BATCH_UPDATE_PROBE_MUTATED_ROWS/);
  assert.match(core, /OneTimeExternalImportAuthorization/);
  const withoutNoOpAclProbes = writer.replace(
    /UPDATE pubquiz\.external_question_import_batches[\s\S]*?WHERE FALSE/g,
    "",
  );
  assert.doesNotMatch(
    withoutNoOpAclProbes,
    /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\s/i,
  );
});

test("Preview and Production reuse the same question record service", () => {
  const preview = read("app/fragen/import/external/externalQuestionImport.server.ts");
  const writer = read("scripts/external-import/production-writer.ts");
  assert.match(preview, /createExternalQuestionRecord/);
  assert.match(writer, /createExternalQuestionRecord/);
  assert.match(writer, /TransactionIsolationLevel\.Serializable/);
  assert.match(writer, /external_question_import_items\.create/);
  const service = read("app/fragen/import/external/externalQuestionWriteService.ts");
  assert.match(service, /freigegeben: false/);
  assert.match(service, /review_status: "IN_REVIEW"/);
  assert.doesNotMatch(service, /approved_at|approved_by_user_id|freigegeben: true/);
});

test("future validated backups emit immutable content-import evidence", () => {
  const workflow = read(".github/workflows/ap94-acceptance.yml");
  assert.match(workflow, /external-import-backup-evidence\.json/);
  assert.match(workflow, /name: external-import-backup-evidence/);
  assert.match(workflow, /readbackVerified: true/);
  assert.match(workflow, /integrityVerified: true/);
});

test("Production writer role setup is target-bound and keeps passwords out of files and arguments", () => {
  const setup = read("scripts/external-import/setup-production-writer.psql");
  const precheck = read("scripts/external-import/precheck-production-writer.psql");
  const wrapper = read("scripts/external-import/invoke-production-writer-role.ps1");
  assert.match(setup, /ep-dawn-paper-alws45vx\.c-3\.eu-central-1\.aws\.neon\.tech/);
  assert.match(setup, /current_database\(\) = 'neondb'/);
  assert.match(setup, /current_user = 'neondb_owner'/);
  assert.match(setup, /NOT EXISTS[\s\S]+pubquiz_external_import_writer/);
  assert.match(setup, /acldefault\('d', database_row\.datdba\)/);
  assert.match(setup, /privilege_row\.grantee = 0/);
  assert.match(setup, /public_temporary_absent[\s\S]+WRITER_SETUP_PUBLIC_TEMPORARY_INHERITED/);
  assert.ok(
    setup.indexOf("public_temporary_absent") <
      setup.indexOf("CREATE ROLE pubquiz_external_import_writer"),
  );
  assert.equal((setup.match(/__ROLE_PASSWORD_SQL_LITERAL__/g) ?? []).length, 1);
  assert.match(wrapper, /sslmode=require channel_binding=require/);
  assert.match(wrapper, /'Precheck'/);
  assert.match(wrapper, /PUBQUIZ_WRITER_PRECHECK\\\|\(PASS\|BLOCK\)/);
  assert.match(wrapper, /\$exitCodeBlocked = 10/);
  assert.match(wrapper, /\$exitCodeTechnicalFailure = 20/);
  assert.match(wrapper, /\$exitCodeProtocolFailure = 21/);
  assert.match(wrapper, /elseif \(\$Mode -eq 'Setup'\)[\s\S]+Invoke-WriterPrecheck[\s\S]+Neues Passwort/);
  assert.match(wrapper, /Read-Host[\s\S]+-AsSecureString/);
  assert.match(wrapper, /PGPASSWORD/);
  assert.match(wrapper, /\$secretUrl \| & gh secret set PRODUCTION_IMPORT_DATABASE_URL --env operations-content-import/);
  assert.doesNotMatch(wrapper, /gh secret set[^\r\n]+--body/);
  assert.doesNotMatch(wrapper, /sslmode=(?:disable|prefer)/);
  assert.doesNotMatch(wrapper, /-v[^\r\n]*(?:password|secret)/i);
  assert.doesNotMatch(setup, /vercel_blob_rw_|npg_[A-Za-z0-9]/);
  assert.match(precheck, /BEGIN TRANSACTION READ ONLY/);
  assert.match(precheck, /PUBQUIZ_WRITER_PRECHECK/);
  assert.match(precheck, /PUBLIC_TEMPORARY_INHERITED/);
  assert.doesNotMatch(precheck, /\\quit\s+\d+/);
  assert.doesNotMatch(precheck, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
});

test("Production TEMPORARY inventory is read-only and excludes secret/query text", () => {
  const inventory = read("scripts/external-import/inventory-production-temporary.psql");
  assert.match(inventory, /BEGIN TRANSACTION READ ONLY/);
  assert.match(inventory, /production_identity_confirmed/);
  assert.match(inventory, /EFFECTIVE DATABASE RIGHTS/);
  assert.match(inventory, /ROLE MEMBERSHIPS/);
  assert.match(inventory, /DEFAULT PRIVILEGES/);
  assert.match(inventory, /CURRENT TEMPORARY RELATIONS/);
  assert.match(inventory, /ROLLBACK/);
  assert.doesNotMatch(inventory, /rolpassword|activity\.query|password_hash/);
  assert.doesNotMatch(
    inventory,
    /^\s*(?:INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|CREATE\s+(?:ROLE|TABLE|SCHEMA)|ALTER\s+ROLE|DROP\s+|TRUNCATE\s+|GRANT\s+|REVOKE\s+)/im,
  );
});

test("Production writer role grants only the external-import write surface", () => {
  const setup = read("scripts/external-import/setup-production-writer.psql");
  assert.match(setup, /GRANT INSERT[\s\S]+ON pubquiz\.fragen TO pubquiz_external_import_writer/);
  assert.match(setup, /GRANT INSERT \(fragen_id, antwort, ist_richtig, antworttyp_id\)[\s\S]+pubquiz\.antworten/);
  assert.match(setup, /GRANT UPDATE \(status, report_json, error_message, completed_at\)[\s\S]+external_question_import_batches/);
  assert.match(setup, /GRANT INSERT[\s\S]+external_question_import_items/);
  assert.doesNotMatch(setup, /GRANT\s+(?:ALL|CREATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/i);
  assert.doesNotMatch(setup, /GRANT\s+UPDATE\s+ON\s+pubquiz\.(?:fragen|antworten|users|quiz|teams)\b/i);
  assert.doesNotMatch(setup, /ALTER DEFAULT PRIVILEGES/i);
});

test("Production writer verification rejects broad ACLs without executing writes", () => {
  const verify = read("scripts/external-import/verify-production-writer.psql");
  assert.match(verify, /external_question_import_batches', 'status', 'UPDATE'/);
  assert.match(verify, /external_question_import_batches', 'report_json', 'UPDATE'/);
  assert.match(verify, /external_question_import_batches', 'error_message', 'UPDATE'/);
  assert.match(verify, /external_question_import_batches', 'completed_at', 'UPDATE'/);
  for (const marker of [
    "WRITER_ROLE_ATTRIBUTES_INVALID",
    "WRITER_ROLE_MEMBERSHIP_INVALID",
    "WRITER_DATABASE_OR_SCHEMA_ACL_INVALID",
    "WRITER_AUTH_ACL_INVALID",
    "WRITER_ALLOWED_TABLE_ACL_TOO_BROAD",
    "WRITER_FOREIGN_DOMAIN_WRITE_ACL_INVALID",
    "WRITER_REQUIRED_SEQUENCE_ACL_MISSING",
  ]) {
    assert.match(verify, new RegExp(marker));
  }
  assert.match(verify, /password_hash/);
  assert.match(verify, /has_database_privilege\(current_user, 'neondb', 'TEMPORARY'\)/);
  assert.match(verify, /BEGIN TRANSACTION READ ONLY/);
  assert.match(verify, /false AS write_executed/);
});

test("first Production plan is immutable and contains only durable human approvals", () => {
  const path =
    "external-import-plans/opentdb-batch-1-production-approved-20260928.json";
  const raw = read(path);
  const plan = JSON.parse(raw) as {
    batchId: string;
    items: Array<{ candidateId: string }>;
    importApproval: {
      records: Array<{
        candidateId: string;
        reviewedAt: string;
        reviewedByUserId: number;
        sourceStatus: string;
      }>;
    };
  };

  assert.equal(plan.batchId, "opentdb-batch-1");
  assert.deepEqual(
    plan.items.map((item) => item.candidateId),
    ["2", "4", "6"],
  );
  assert.deepEqual(
    plan.importApproval.records.map((record) => ({
      candidateId: record.candidateId,
      reviewedAt: record.reviewedAt,
      reviewedByUserId: record.reviewedByUserId,
      sourceStatus: record.sourceStatus,
    })),
    [
      {
        candidateId: "2",
        reviewedAt: "2026-09-26T17:59:08.666Z",
        reviewedByUserId: 1,
        sourceStatus: "APPROVED",
      },
      {
        candidateId: "4",
        reviewedAt: "2026-09-26T18:00:49.513Z",
        reviewedByUserId: 1,
        sourceStatus: "APPROVED",
      },
      {
        candidateId: "6",
        reviewedAt: "2026-09-26T18:01:12.177Z",
        reviewedByUserId: 1,
        sourceStatus: "APPROVED",
      },
    ],
  );
  assert.equal(
    createHash("sha256").update(raw, "utf8").digest("hex"),
    "971fab02b232fe8bac8ec31a6b6901f08415113f2a76cc38a284e3dab139581d",
  );
});
