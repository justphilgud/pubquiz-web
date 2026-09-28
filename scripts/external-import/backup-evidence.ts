import { readFile } from "node:fs/promises";

import type { ExternalImportBackupEvidence } from "../../app/fragen/import/external/productionImportGuard";
import { DATABASES } from "../operations/guards";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseExternalImportBackupEvidence(
  value: unknown,
  expected: Readonly<{
    run: string;
    attempt: string;
    backupId: string;
    manifestSha256: string;
    productionSha: string;
  }>,
): ExternalImportBackupEvidence {
  if (!record(value) || !record(value.source)) {
    throw new Error("EXTERNAL_IMPORT_BACKUP_EVIDENCE_INVALID");
  }
  const evidence = value as unknown as ExternalImportBackupEvidence;
  if (
    evidence.version !== 1 ||
    evidence.backupRun !== expected.run ||
    evidence.backupAttempt !== expected.attempt ||
    evidence.backupId !== expected.backupId ||
    evidence.manifestSha256 !== expected.manifestSha256 ||
    evidence.productionSha !== expected.productionSha ||
    evidence.backupId !== `production/acceptance/run-${expected.run}-${expected.attempt}` ||
    evidence.source.host !== DATABASES.production.host ||
    evidence.source.database !== DATABASES.production.name ||
    evidence.source.schema !== DATABASES.production.schema ||
    !evidence.completed || !evidence.manifestPresent ||
    !evidence.readbackVerified || !evidence.integrityVerified ||
    !Number.isFinite(Date.parse(evidence.snapshotAt)) ||
    !Number.isFinite(Date.parse(evidence.completedAt)) ||
    Date.parse(evidence.completedAt) < Date.parse(evidence.snapshotAt)
  ) {
    throw new Error("EXTERNAL_IMPORT_BACKUP_EVIDENCE_MISMATCH");
  }
  return Object.freeze({
    ...evidence,
    source: Object.freeze({ ...evidence.source }),
  });
}

export async function loadExternalImportBackupEvidence(input: {
  path: string;
  run: string;
  attempt: string;
  backupId: string;
  manifestSha256: string;
  productionSha: string;
}) {
  const raw = JSON.parse(await readFile(input.path, "utf8")) as unknown;
  return parseExternalImportBackupEvidence(raw, input);
}

export async function verifyBackupWorkflowRun(input: {
  repository: string;
  run: string;
  attempt: string;
  token: string;
  request?: typeof fetch;
}) {
  if (
    input.repository !== "justphilgud/pubquiz-web" ||
    !/^[1-9][0-9]{0,19}$/.test(input.run) ||
    !/^[1-9][0-9]{0,5}$/.test(input.attempt) ||
    !input.token
  ) throw new Error("EXTERNAL_IMPORT_BACKUP_RUN_INVALID");
  const response = await (input.request ?? fetch)(
    `https://api.github.com/repos/${input.repository}/actions/runs/${input.run}`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.token}`,
        "x-github-api-version": "2022-11-28",
      },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new Error("EXTERNAL_IMPORT_BACKUP_RUN_UNAVAILABLE");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 128 * 1024) throw new Error("EXTERNAL_IMPORT_BACKUP_RUN_INVALID");
  const value = JSON.parse(bytes.toString("utf8")) as unknown;
  if (!record(value)) throw new Error("EXTERNAL_IMPORT_BACKUP_RUN_INVALID");
  if (
    String(value.id) !== input.run ||
    String(value.run_attempt) !== input.attempt ||
    value.path !== ".github/workflows/ap94-acceptance.yml" ||
    value.head_branch !== "main" ||
    value.status !== "completed" || value.conclusion !== "success" ||
    (value.event !== "workflow_dispatch" && value.event !== "schedule")
  ) throw new Error("EXTERNAL_IMPORT_BACKUP_RUN_MISMATCH");
  return { verified: true as const };
}
