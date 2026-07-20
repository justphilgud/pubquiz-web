import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepositoryFile(path: string) {
  return readFileSync(path, "utf8");
}

const ci = readRepositoryFile(".github/workflows/ci.yml");
const changedLintScript = readRepositoryFile("scripts/lint-changed-files.ts");
const preview = readRepositoryFile(".github/workflows/deploy-preview.yml");
const production = readRepositoryFile(".github/workflows/deploy-production.yml");
const qualityJob = ci.slice(
  ci.indexOf("  quality:"),
  ci.indexOf("  repository-lint-information:"),
);
const repositoryLintJob = ci.slice(
  ci.indexOf("  repository-lint-information:"),
);
const vercelConfiguration = JSON.parse(readRepositoryFile("vercel.json")) as {
  git?: { deploymentEnabled?: boolean };
};

const forbiddenPrismaCommands = [
  "prisma migrate dev",
  "prisma migrate reset",
  "prisma migrate resolve",
  "prisma db push",
];

test("blocking CI performs all quality checks without migrations or deployment secrets", () => {
  for (const command of [
    "npm ci",
    "npm run db:generate",
    "npm run db:validate",
    "npm run typecheck",
    "npm test",
    "npx eslint --max-warnings=0",
    "npm run lint:changed",
    "npm run build",
  ]) {
    assert.match(qualityJob, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(qualityJob, /migrate deploy|VERCEL_TOKEN|secrets\./);
  assert.doesNotMatch(qualityJob, /npm run lint -- --max-warnings=0/);
});

test("changed-file ESLint handles pull requests, feature pushes and main pushes", () => {
  for (const workflowStructure of [
    "fetch-depth: 0",
    "github.event.pull_request.base.sha",
    "github.event.pull_request.head.sha",
    "github.event.before",
    "npm run lint:changed",
  ]) {
    assert.match(qualityJob, new RegExp(workflowStructure.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const requiredStructure of [
    "process.env.CI_BASE_SHA",
    "process.env.CI_BEFORE_SHA",
    "process.env.CI_HEAD_SHA",
    "merge-base",
    "refs/remotes/origin/main",
    "hash-object",
    "--diff-filter=ACMR",
    "-z",
    "Keine geänderten JavaScript-/TypeScript-Dateien",
  ]) {
    assert.match(changedLintScript, new RegExp(requiredStructure.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const extension of ["*.js", "*.jsx", "*.mjs", "*.cjs", "*.ts", "*.tsx", "*.mts", "*.cts"]) {
    assert.match(changedLintScript, new RegExp(extension.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("CI/CD package TypeScript is enforced with zero warnings", () => {
  for (const path of [
    "scripts/ci-workflows.test.ts",
    "scripts/lint-changed-files.ts",
    "scripts/lint-changed-files.test.ts",
    "scripts/validate-deployment-environment.ts",
    "scripts/validate-deployment-environment.test.ts",
  ]) {
    assert.match(qualityJob, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(qualityJob, /npx eslint --max-warnings=0/);
});

test("full repository ESLint remains visible and explicitly non-blocking", () => {
  assert.match(repositoryLintJob, /Informational only — full repository ESLint debt/);
  assert.match(repositoryLintJob, /continue-on-error: true/);
  assert.match(repositoryLintJob, /npm run lint -- --max-warnings=0/);
  assert.match(repositoryLintJob, /The repository is \*\*not\*\* fully lint-clean/);
  assert.match(repositoryLintJob, /does not gate deployments during the transition/);
});

test("Preview is gated, serialized and deploys only after migrate deploy", () => {
  assert.match(preview, /environment: preview/);
  assert.match(preview, /group: preview-deployment/);
  assert.match(preview, /cancel-in-progress: false/);
  assert.match(preview, /ACTIONS_DEPLOYMENTS_ENABLED/);
  assert.match(preview, /head_repository\.full_name == github\.repository/);
  assert.ok(preview.indexOf("npm run db:deploy") < preview.indexOf("vercel@56.3.2 build"));
  assert.match(preview, /deploy --prebuilt --token/);
  assert.doesNotMatch(preview, /deploy --prebuilt --prod/);
});

test("Production is gated, serialized, main-only and explicitly uses --prod", () => {
  assert.match(production, /environment: production/);
  assert.match(production, /group: production-deployment/);
  assert.match(production, /cancel-in-progress: false/);
  assert.match(production, /ACTIONS_DEPLOYMENTS_ENABLED/);
  assert.match(production, /head_branch == 'main'/);
  assert.match(production, /github\.ref == 'refs\/heads\/main'/);
  assert.ok(production.indexOf("npm run db:deploy") < production.indexOf("vercel@56.3.2 build --prod"));
  assert.match(production, /deploy --prebuilt --prod --token/);
});

test("Deployment workflows contain no destructive Prisma commands", () => {
  for (const command of forbiddenPrismaCommands) {
    assert.doesNotMatch(preview, new RegExp(command.replaceAll(" ", "\\s+")));
    assert.doesNotMatch(production, new RegExp(command.replaceAll(" ", "\\s+")));
  }
});

test("Vercel Git deployments are disabled for every branch", () => {
  assert.equal(vercelConfiguration.git?.deploymentEnabled, false);
});
