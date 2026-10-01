import { readFile, writeFile } from "node:fs/promises";

import {
  externalImportPlanDigest,
  validateExternalImportPlan,
  type ExternalImportPlan,
} from "../../app/fragen/import/external/productionImportGuard";
import { externalImportApprovalComment } from "../../app/fragen/import/external/reviewerApproval";
import { loadExternalImportBackupEvidence, verifyBackupWorkflowRun } from "./backup-evidence";
import { externalImportDryRun } from "./dry-run";

function required(value: string | undefined, code: string) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

export async function externalImportWorkflowPreflight(input: {
  planPath: string;
  backupEvidencePath: string;
  reportPath: string;
  environment?: Readonly<Record<string, string | undefined>>;
  now?: Date;
}) {
  const env = input.environment ?? process.env;
  const raw = JSON.parse(await readFile(input.planPath, "utf8")) as unknown;
  validateExternalImportPlan(raw);
  const plan = raw as ExternalImportPlan;
  const digest = externalImportPlanDigest(plan);
  if (digest !== required(env.EXTERNAL_IMPORT_PLAN_SHA256, "EXTERNAL_IMPORT_DIGEST_REQUIRED")) {
    throw new Error("EXTERNAL_IMPORT_DIGEST_MISMATCH");
  }
  if (plan.batchId !== required(env.EXTERNAL_IMPORT_BATCH_ID, "EXTERNAL_IMPORT_BATCH_ID_REQUIRED")) {
    throw new Error("EXTERNAL_IMPORT_BATCH_MISMATCH");
  }
  const productionSha = required(env.PRODUCTION_RELEASE_SHA, "EXTERNAL_IMPORT_PRODUCTION_SHA_REQUIRED");
  const run = required(env.EXTERNAL_IMPORT_BACKUP_RUN, "EXTERNAL_IMPORT_BACKUP_RUN_REQUIRED");
  const attempt = required(env.EXTERNAL_IMPORT_BACKUP_ATTEMPT, "EXTERNAL_IMPORT_BACKUP_ATTEMPT_REQUIRED");
  const backupId = required(env.EXTERNAL_IMPORT_BACKUP_ID, "EXTERNAL_IMPORT_BACKUP_ID_REQUIRED");
  const manifestSha256 = required(env.EXTERNAL_IMPORT_BACKUP_MANIFEST_SHA256, "EXTERNAL_IMPORT_BACKUP_MANIFEST_REQUIRED");
  const githubToken = required(env.GITHUB_TOKEN, "EXTERNAL_IMPORT_GITHUB_TOKEN_REQUIRED");
  await verifyBackupWorkflowRun({
    repository: required(env.GITHUB_REPOSITORY, "EXTERNAL_IMPORT_REPOSITORY_REQUIRED"),
    run,
    attempt,
    token: githubToken,
  });
  const backup = await loadExternalImportBackupEvidence({
    path: input.backupEvidencePath,
    run,
    attempt,
    backupId,
    manifestSha256,
    productionSha,
  });
  const dryRun = await externalImportDryRun({
    planPath: input.planPath,
    expectedDigest: digest,
    connectionString: required(env.PRODUCTION_BACKUP_DATABASE_URL, "EXTERNAL_IMPORT_READER_REQUIRED"),
    productionSha,
    now: input.now,
    environment: env,
    backup,
  });
  if (!dryRun.guard.gates.plan || !dryRun.guard.gates.digest ||
      !dryRun.guard.gates.environment || !dryRun.guard.gates.host ||
      !dryRun.guard.gates.database || !dryRun.guard.gates.preflight ||
      !dryRun.guard.gates.backup) {
    throw new Error("EXTERNAL_IMPORT_PREFLIGHT_GUARD_BLOCKED");
  }
  const approvalComment = externalImportApprovalComment({
    planDigest: digest,
    candidateIds: plan.items.map((item) => item.candidateId),
    backupId,
  });
  const report = {
    version: 1,
    ...dryRun,
    backup: {
      id: backup.backupId,
      run: backup.backupRun,
      attempt: backup.backupAttempt,
      snapshotAt: backup.snapshotAt,
      manifestSha256: backup.manifestSha256,
      verified: true,
    },
    approvalComment,
    writeAuthorized: false,
  };
  await writeFile(input.reportPath, `${JSON.stringify(report)}\n`, { mode: 0o600 });
  return report;
}

async function main() {
  const report = await externalImportWorkflowPreflight({
    planPath: required(process.argv[2], "EXTERNAL_IMPORT_PLAN_PATH_REQUIRED"),
    backupEvidencePath: required(process.argv[3], "EXTERNAL_IMPORT_BACKUP_EVIDENCE_PATH_REQUIRED"),
    reportPath: required(process.argv[4], "EXTERNAL_IMPORT_PREFLIGHT_PATH_REQUIRED"),
  });
  process.stdout.write(`${JSON.stringify({
    batchId: report.batchId,
    planDigest: report.planDigest,
    preflight: report.preflight.counts,
    backupId: report.backup.id,
    approvalComment: report.approvalComment,
    writeAuthorized: false,
  })}\n`);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/external-import/workflow-preflight.ts")) {
  main().catch((error) => {
    const code = error instanceof Error && /^EXTERNAL_IMPORT_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "EXTERNAL_IMPORT_PREFLIGHT_FAILED_DETAILS_WITHHELD";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
