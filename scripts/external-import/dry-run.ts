import { readFile } from "node:fs/promises";

import {
  evaluateExternalImportGuard,
  externalImportPlanDigest,
  validateExternalImportPlan,
  type ExternalImportPlan,
} from "../../app/fragen/import/external/productionImportGuard";
import { DATABASES } from "../operations/guards";
import { readProductionExternalImportPreflight } from "./production-preflight";

function required(value: string | undefined, code: string) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

export async function externalImportDryRun(input: {
  planPath: string;
  expectedDigest: string;
  connectionString: string;
  productionSha: string;
  now?: Date;
  environment?: Readonly<Record<string, string | undefined>>;
}) {
  const raw = JSON.parse(await readFile(input.planPath, "utf8")) as unknown;
  validateExternalImportPlan(raw);
  const plan = raw as ExternalImportPlan;
  const digest = externalImportPlanDigest(plan);
  if (digest !== input.expectedDigest) throw new Error("EXTERNAL_IMPORT_DIGEST_MISMATCH");
  const snapshot = await readProductionExternalImportPreflight({
    connectionString: input.connectionString,
    plan,
  });
  const env = input.environment ?? process.env;
  const guard = evaluateExternalImportGuard({
    mode: "dry-run",
    now: input.now ?? new Date(),
    plan,
    suppliedDigest: input.expectedDigest,
    execution: {
      logicalEnvironment: env.EXTERNAL_IMPORT_LOGICAL_ENVIRONMENT === "production"
        ? "production"
        : "unknown",
      kind: env.GITHUB_ACTIONS === "true" ? "github-actions" : "local",
      repository: env.GITHUB_REPOSITORY,
      ref: env.GITHUB_REF,
      eventName: env.GITHUB_EVENT_NAME,
      workflowRef: env.GITHUB_WORKFLOW_REF,
      expectedWorkflowRef: env.EXTERNAL_IMPORT_EXPECTED_WORKFLOW_REF,
      githubEnvironment: env.EXTERNAL_IMPORT_GITHUB_ENVIRONMENT,
    },
    actualDatabase: snapshot.identity,
    expectedDatabase: {
      host: DATABASES.production.host,
      database: DATABASES.production.name,
      schema: DATABASES.production.schema,
    },
    currentProductionSha: input.productionSha,
    preflight: snapshot.preflight,
  });
  return {
    mode: "dry-run" as const,
    productionRead: true,
    productionChanged: false,
    batchId: plan.batchId,
    sourceType: plan.sourceType,
    planDigest: digest,
    candidateCount: plan.items.length,
    productionQuestionCount: snapshot.questionCount,
    databaseIdentityConfirmed: guard.gates.database,
    preflight: snapshot.preflight,
    guard: { ...guard, writeAuthorized: false },
  };
}

async function main() {
  const planPath = required(process.argv[2], "EXTERNAL_IMPORT_PLAN_PATH_REQUIRED");
  const result = await externalImportDryRun({
    planPath,
    expectedDigest: required(process.env.EXTERNAL_IMPORT_PLAN_SHA256, "EXTERNAL_IMPORT_DIGEST_REQUIRED"),
    connectionString: required(process.env.PRODUCTION_BACKUP_DATABASE_URL, "EXTERNAL_IMPORT_READER_REQUIRED"),
    productionSha: required(process.env.PRODUCTION_RELEASE_SHA, "EXTERNAL_IMPORT_PRODUCTION_SHA_REQUIRED"),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/external-import/dry-run.ts")) {
  main().catch((error) => {
    const code = error instanceof Error && /^EXTERNAL_IMPORT_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "EXTERNAL_IMPORT_DRY_RUN_FAILED_DETAILS_WITHHELD";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
