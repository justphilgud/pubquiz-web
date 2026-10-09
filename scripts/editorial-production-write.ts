import { readFileSync, writeFileSync } from "node:fs";
import { runEditorialDatabaseImport } from "../app/fragen/import/external/editorialImportDatabase";
import { approvedProductionEditorialSource, EditorialProductionWriteAuthorization, EDITORIAL_WRITER_WORKFLOW } from "../app/fragen/import/external/editorialProductionPolicy";
import { fetchVerifiedExternalImportReviewerApproval, externalImportApprovalComment } from "../app/fragen/import/external/reviewerApproval";
import { loadExternalImportBackupEvidence, verifyBackupWorkflowRun } from "./external-import/backup-evidence";

async function main() {
  const env = process.env;
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== "justphilgud/pubquiz-web" || env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_WORKFLOW_REF !== EDITORIAL_WRITER_WORKFLOW ||
    !/^[a-f0-9]{40}$/.test(env.EDITORIAL_PRODUCTION_SHA ?? "") || env.EDITORIAL_PRODUCTION_SHA !== env.PRODUCTION_RELEASE_SHA) throw new Error("EDITORIAL_PRODUCTION_CONTEXT_INVALID");
  const source = approvedProductionEditorialSource();
  const backupId = "production/acceptance/run-37971426600-1";
  const backup = await loadExternalImportBackupEvidence({ path: process.argv[3], run: "37971426600", attempt: "1", backupId,
    manifestSha256: "5dfa4924e283a354376716f6e03c8924fb401eaa28d5580dc572afdd006d6720", productionSha: "2258c182e68c40a54fbdc4f0a855c9a7306d1a10" });
  if (Date.now() - Date.parse(backup.snapshotAt) > 24 * 60 * 60 * 1000 || Date.parse(backup.snapshotAt) > Date.now()) throw new Error("EDITORIAL_BACKUP_STALE");
  await verifyBackupWorkflowRun({ repository: "justphilgud/pubquiz-web", run: "37971426600", attempt: "1", token: env.GITHUB_TOKEN ?? "" });
  // Existing restore evidence is independent of the later additive nullable migration.
  const restore = await fetch("https://api.github.com/repos/justphilgud/pubquiz-web/actions/runs/37985816031", {
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: "application/vnd.github+json" }, redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!restore.ok) throw new Error("EDITORIAL_RESTORE_EVIDENCE_UNAVAILABLE");
  const restored = await restore.json();
  if (restored.id !== 37985816031 || restored.conclusion !== "success" || restored.head_branch !== "main") throw new Error("EDITORIAL_RESTORE_EVIDENCE_INVALID");
  if (process.argv[2] === "preflight") {
    if (env.EDITORIAL_GITHUB_ENVIRONMENT !== "operations-backup") throw new Error("EDITORIAL_PRODUCTION_CONTEXT_INVALID");
    // Existing context guard pins the read-only entry point; preserve it unchanged.
    const result = await runEditorialDatabaseImport({ connectionString: env.PRODUCTION_BACKUP_DATABASE_URL ?? "", source, mode: "dry-run", productionPreflight: true });
    if (result.mode !== "dry-run") throw new Error("EDITORIAL_READ_ONLY_REQUIRED");
    const schema = result.productionSchema as { migrations: {migration_name:string;finished_at:unknown;rolled_back_at:unknown}[]; difficultyColumn:{data_type:string;is_nullable:string;character_maximum_length:number}[]; difficultyConstraint:{convalidated:boolean;definition:string}[] };
    if (schema.migrations.some(m=>!m.finished_at&&!m.rolled_back_at) || !schema.migrations.some(m=>m.migration_name==='20261008090000_editorial_question_difficulty'&&m.finished_at&&!m.rolled_back_at) ||
      schema.difficultyColumn.length!==1 || schema.difficultyColumn[0].is_nullable!=='YES' || schema.difficultyColumn[0].data_type!=='character varying' || schema.difficultyColumn[0].character_maximum_length!==10 ||
      schema.difficultyConstraint.length!==1 || !schema.difficultyConstraint[0].convalidated || !['LEICHT','MITTEL','SCHWER'].every(v=>schema.difficultyConstraint[0].definition.includes(`'${v}'`))) throw new Error('EDITORIAL_PRODUCTION_SCHEMA_BLOCKED');
    const candidateIds = result.decisions.filter(d => d.action === "IMPORTIEREN").map(d => d.candidate.externalId);
    if (!candidateIds.length) throw new Error("EDITORIAL_NOTHING_TO_IMPORT");
    const report = { ...result, productionSha: env.EDITORIAL_PRODUCTION_SHA, backupId, candidateIds, createdAt: new Date().toISOString(),
      approvalComment: externalImportApprovalComment({ planDigest: result.digest, candidateIds, backupId }) };
    writeFileSync("editorial-write-preflight.json", JSON.stringify(report, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ candidates: source.candidates.length, importable: candidateIds.length, writeAuthorized: false }));
    return;
  }
  if (process.argv[2] !== "write" || env.EDITORIAL_GITHUB_ENVIRONMENT !== "operations-content-import") throw new Error("EDITORIAL_WRITE_MODE_INVALID");
  const report = JSON.parse(readFileSync(process.argv[4], "utf8"));
  if (report.mode !== "dry-run" || report.productionSha !== env.EDITORIAL_PRODUCTION_SHA || report.backupId !== backupId ||
    Date.now() - Date.parse(report.createdAt) > 60 * 60 * 1000 || !Number.isFinite(Date.parse(report.createdAt))) throw new Error("EDITORIAL_PREFLIGHT_STALE");
  const review = await fetchVerifiedExternalImportReviewerApproval({ repository: "justphilgud/pubquiz-web", runId: env.GITHUB_RUN_ID ?? "", runAttempt: env.GITHUB_RUN_ATTEMPT ?? "",
    planDigest: report.digest, candidateIds: report.candidateIds, backupId, token: env.GITHUB_TOKEN ?? "" });
  const result = await runEditorialDatabaseImport({ connectionString: env.PRODUCTION_IMPORT_DATABASE_URL ?? "", source, mode: "import", operatorUserId: Number(env.EDITORIAL_OPERATOR_USER_ID),
    expectedDryRunDigest: report.digest, productionWrite: new EditorialProductionWriteAuthorization(review) });
  writeFileSync("editorial-import-manifest.json", JSON.stringify(result.manifest, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ imported: result.questionIds.length, questionIds: result.questionIds, integrityVerified: true }));
}
main().catch(() => { console.error("EDITORIAL_PRODUCTION_OPERATION_FAILED_DETAILS_WITHHELD"); process.exitCode = 1; });
