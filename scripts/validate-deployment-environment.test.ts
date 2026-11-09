import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  DeploymentValidationError,
  readDatabaseUrlFromEnvironmentFile,
  validateDeploymentEnvironment,
} from "./validate-deployment-environment";

const previewInput = {
  deploymentEnvironment: "preview",
  deploymentEvent: "push",
  deploymentRef: "refs/heads/feature/ci-cd",
  deploymentRepository: "justphilgud/pubquiz-web",
  databaseUrl:
    "postgresql://preview-user:preview-password@ep-preview.example.neon.tech/pubquiz-preview?sslmode=require&channel_binding=require",
  expectedDatabaseBranch: "ep-preview",
  expectedDatabaseHost: "ep-preview.example.neon.tech",
  expectedDatabaseName: "pubquiz-preview",
} as const;

const productionInput = {
  deploymentEnvironment: "production",
  deploymentEvent: "push",
  deploymentRef: "refs/heads/main",
  deploymentRepository: "justphilgud/pubquiz-web",
  databaseUrl:
    "postgresql://production-user:production-password@ep-production.example.neon.tech/production?sslmode=require",
  expectedDatabaseBranch: "ep-production",
  expectedDatabaseHost: "ep-production.example.neon.tech",
  expectedDatabaseName: "production",
} as const;

function assertValidationCode(input: Record<string, string | undefined>, code: string) {
  assert.throws(
    () => validateDeploymentEnvironment(input),
    (error) =>
      error instanceof DeploymentValidationError && error.code === code,
  );
}

test("accepts an explicitly whitelisted preview database", () => {
  const summary = validateDeploymentEnvironment(previewInput);

  assert.equal(summary.environment, "PREVIEW");
  assert.equal(summary.databaseHost, previewInput.expectedDatabaseHost);
  assert.equal(summary.databaseName, previewInput.expectedDatabaseName);
  assert.equal(summary.databaseBranchVerified, true);
});

test("accepts an explicitly whitelisted production database", () => {
  const summary = validateDeploymentEnvironment(productionInput);

  assert.equal(summary.environment, "PRODUCTION");
  assert.equal(summary.branch, "main");
});

test("rejects production identity in preview", () => {
  assertValidationCode(
    { ...previewInput, databaseUrl: productionInput.databaseUrl },
    "DATABASE_HOST_MISMATCH",
  );
});

test("rejects preview identity in production", () => {
  assertValidationCode(
    { ...productionInput, databaseUrl: previewInput.databaseUrl },
    "DATABASE_HOST_MISMATCH",
  );
});

test("rejects a missing database URL", () => {
  assertValidationCode(
    { ...previewInput, databaseUrl: undefined },
    "DATABASE_URL_MISSING",
  );
});

test("rejects an invalid database URL", () => {
  assertValidationCode(
    { ...previewInput, databaseUrl: "not-a-url" },
    "DATABASE_URL_INVALID",
  );
});

test("rejects a non-PostgreSQL protocol", () => {
  assertValidationCode(
    { ...previewInput, databaseUrl: "https://ep-preview.example.neon.tech/pubquiz-preview" },
    "DATABASE_PROTOCOL_INVALID",
  );
});

test("rejects the wrong database name", () => {
  assertValidationCode(
    {
      ...previewInput,
      databaseUrl:
        "postgresql://preview-user:preview-password@ep-preview.example.neon.tech/not-preview",
    },
    "DATABASE_NAME_MISMATCH",
  );
});

test("rejects production outside main", () => {
  assertValidationCode(
    { ...productionInput, deploymentRef: "refs/heads/feature/not-main" },
    "PRODUCTION_REF_INVALID",
  );
});

test("rejects pull request deployment contexts", () => {
  assertValidationCode(
    { ...previewInput, deploymentEvent: "pull_request" },
    "DEPLOYMENT_EVENT_INVALID",
  );
});

test("safe summary contains neither credentials nor query parameters", () => {
  const serialized = JSON.stringify(validateDeploymentEnvironment(previewInput));

  assert.doesNotMatch(serialized, /preview-user|preview-password|sslmode|channel_binding/);
});

test("reads the Vercel environment file instead of an inherited GitHub URL", () => {
  const directory = mkdtempSync(join(tmpdir(), "pubquiz-deployment-validation-"));
  const path = join(directory, ".env.preview.local");
  const inheritedDatabaseUrl = process.env.DATABASE_URL;

  try {
    process.env.DATABASE_URL = productionInput.databaseUrl;
    writeFileSync(path, `DATABASE_URL="${previewInput.databaseUrl}"\n`, "utf8");

    assert.equal(
      readDatabaseUrlFromEnvironmentFile(path),
      previewInput.databaseUrl,
    );
    assert.equal(process.env.DATABASE_URL, productionInput.databaseUrl);
  } finally {
    if (inheritedDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = inheritedDatabaseUrl;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

test("isolated print preview binds only its exact approved branch, host, database and endpoint", () => {
  const review = {
    ...previewInput,
    deploymentRef: "refs/heads/codex/bingo-print-templates-ui",
    expectedDatabaseHost: "ep-holy-term-baa881iq-pooler.c-8.eu-central-1.aws.neon.tech",
    expectedDatabaseName: "bingo_print_v4_review",
    expectedDatabaseBranch: "ep-holy-term-baa881iq",
    databaseUrl: "postgresql://synthetic:fixture@ep-holy-term-baa881iq-pooler.c-8.eu-central-1.aws.neon.tech/bingo_print_v4_review?sslmode=verify-full",
  };
  assert.equal(validateDeploymentEnvironment(review).databaseBranchVerified, true);
  const direct = review.expectedDatabaseHost.replace("-pooler.", ".");
  assert.equal(validateDeploymentEnvironment({ ...review, expectedDatabaseHost: direct, databaseUrl: review.databaseUrl.replace("-pooler.", ".") }).databaseHost, direct);
  assertValidationCode({ ...previewInput, deploymentRef: review.deploymentRef }, "BINGO_PRINT_REVIEW_IDENTITY_MISMATCH");
  assertValidationCode({ ...review, expectedDatabaseBranch: undefined }, "BINGO_PRINT_REVIEW_IDENTITY_MISMATCH");
  assertValidationCode({ ...review, expectedDatabaseName: "foreign", databaseUrl: review.databaseUrl.replace("bingo_print_v4_review", "foreign") }, "BINGO_PRINT_REVIEW_IDENTITY_MISMATCH");
  assertValidationCode({ ...productionInput, deploymentEnvironment: "preview", deploymentRef: review.deploymentRef }, "BINGO_PRINT_REVIEW_IDENTITY_MISMATCH");
  assertValidationCode({ ...review, deploymentRef: "refs/heads/feature/other" }, "ISOLATED_PREVIEW_SCOPE_MISMATCH");
  assertValidationCode({ ...review, deploymentEnvironment: "production", deploymentRef: "refs/heads/main" }, "ISOLATED_PREVIEW_SCOPE_MISMATCH");
});
test('Matching Preview binds its own database without opening the existing print preview target',()=>{
 const matching={...previewInput,deploymentRef:'refs/heads/codex/bingo-matching-table',expectedDatabaseHost:'ep-holy-term-baa881iq-pooler.c-8.eu-central-1.aws.neon.tech',expectedDatabaseName:'bingo_matching_review',expectedDatabaseBranch:'ep-holy-term-baa881iq',databaseUrl:'postgresql://synthetic:fixture@ep-holy-term-baa881iq-pooler.c-8.eu-central-1.aws.neon.tech/bingo_matching_review?sslmode=verify-full'};
 assert.equal(validateDeploymentEnvironment(matching).databaseBranchVerified,true);
 assert.equal(validateDeploymentEnvironment({...matching,expectedDatabaseHost:matching.expectedDatabaseHost.replace('-pooler.','.'),databaseUrl:matching.databaseUrl.replace('-pooler.','.')}).databaseBranchVerified,true);
 for(const name of ['bingo_print_v4_review','neondb','foreign'])assertValidationCode({...matching,expectedDatabaseName:name,databaseUrl:matching.databaseUrl.replace('bingo_matching_review',name)},'BINGO_MATCHING_REVIEW_IDENTITY_MISMATCH');
 assertValidationCode({...matching,expectedDatabaseBranch:undefined},'BINGO_MATCHING_REVIEW_IDENTITY_MISMATCH');
 assertValidationCode({...previewInput,deploymentRef:matching.deploymentRef},'BINGO_MATCHING_REVIEW_IDENTITY_MISMATCH');
 assertValidationCode({...matching,deploymentEnvironment:'production',deploymentRef:'refs/heads/main'},'ISOLATED_PREVIEW_SCOPE_MISMATCH');
 assertValidationCode({...matching,deploymentRef:'refs/heads/codex/foreign'},'ISOLATED_PREVIEW_SCOPE_MISMATCH');
 assertValidationCode({...matching,deploymentRef:'refs/heads/codex/bingo-print-templates-ui'},'BINGO_PRINT_REVIEW_IDENTITY_MISMATCH');
});

test('Matching UX Preview requires its separately approved exact database and cannot reuse other targets',()=>{
 const ux={...previewInput,deploymentRef:'refs/heads/codex/bingo-matching-ux-polish',expectedDatabaseHost:'ep-holy-term-baa881iq-pooler.c-8.eu-central-1.aws.neon.tech',expectedDatabaseName:'bingo_matching_ux_review',expectedDatabaseBranch:'ep-holy-term-baa881iq',databaseUrl:'postgresql://synthetic:fixture@ep-holy-term-baa881iq-pooler.c-8.eu-central-1.aws.neon.tech/bingo_matching_ux_review?sslmode=verify-full'};
 assert.equal(validateDeploymentEnvironment(ux).databaseBranchVerified,true);
 assert.equal(validateDeploymentEnvironment({...ux,expectedDatabaseHost:ux.expectedDatabaseHost.replace('-pooler.','.'),databaseUrl:ux.databaseUrl.replace('-pooler.','.')}).databaseBranchVerified,true);
 for(const name of ['bingo_matching_review','bingo_print_v4_review','neondb','foreign'])assertValidationCode({...ux,expectedDatabaseName:name,databaseUrl:ux.databaseUrl.replace('bingo_matching_ux_review',name)},'BINGO_MATCHING_UX_REVIEW_IDENTITY_MISMATCH');
 assertValidationCode({...ux,expectedDatabaseBranch:undefined},'BINGO_MATCHING_UX_REVIEW_IDENTITY_MISMATCH');
 assertValidationCode({...previewInput,deploymentRef:ux.deploymentRef},'BINGO_MATCHING_UX_REVIEW_IDENTITY_MISMATCH');
 assertValidationCode({...ux,deploymentEnvironment:'production',deploymentRef:'refs/heads/main'},'ISOLATED_PREVIEW_SCOPE_MISMATCH');
 assertValidationCode({...ux,deploymentRef:'refs/heads/codex/foreign'},'ISOLATED_PREVIEW_SCOPE_MISMATCH');
 assertValidationCode({...ux,deploymentRef:'refs/heads/codex/bingo-matching-table'},'BINGO_MATCHING_REVIEW_IDENTITY_MISMATCH');
 assertValidationCode({...ux,deploymentRef:'refs/heads/codex/bingo-print-templates-ui'},'BINGO_PRINT_REVIEW_IDENTITY_MISMATCH');
});
