import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { needsApplicationDeployment } from "./deployment-scope";
test("operations-only deployment exclusion never suppresses mixed application/schema/package changes", () => {
  const ops = ["scripts/operations/acceptance-cli.ts", "scripts/operations/bridge/api/access.ts", "scripts/operations/bridge/package-lock.json",
    ".github/workflows/ap94-bridge-ci.yml", ".github/workflows/ap94-acceptance.yml", ".github/workflows/deploy-production.yml",
    ".github/workflows/production-read-only-preflight.yml", ".github/workflows/production-preflight-ci.yml"];
  assert.equal(needsApplicationDeployment(ops), false);
  for (const path of ["app/page.tsx", "prisma/schema.prisma", "package-lock.json", "next.config.ts", ".github/workflows/ci.yml", "scripts/deploy.ts"]) assert.equal(needsApplicationDeployment([...ops, path]), true);
});
test("production deployment requires scope job and retains environment review", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/deploy-production.yml", import.meta.url), "utf8");
  assert.match(workflow, /needs: deployment-scope/); assert.match(workflow, /needs.deployment-scope.outputs.required == 'true'/);
  assert.match(workflow, /environment: production/); assert.match(workflow, /fetch-depth: 2/);
});

test('complete PR97 integration skips the combined migration/deployment job',()=>{
  const paths=['.github/workflows/production-preflight-ci.yml','.github/workflows/production-read-only-preflight.yml',
    'docs/operations/production-read-only-preflight.md','scripts/operations/deployment-scope.test.ts','scripts/operations/deployment-scope.ts',
    'scripts/operations/production-preflight-cli.ts','scripts/operations/production-preflight.integration.test.ts',
    'scripts/operations/production-preflight.test.ts','scripts/operations/production-preflight.ts'];
  assert.equal(needsApplicationDeployment(paths),false);
  const workflow=readFileSync('.github/workflows/deploy-production.yml','utf8');
  assert.match(workflow,/needs: deployment-scope/);assert.match(workflow,/needs.deployment-scope.outputs.required == 'true'/);
  const guardedJob=workflow.split('  deploy-production:')[1];
  assert.match(guardedJob,/npm run db:deploy/);assert.match(guardedJob,/vercel@.* deploy --yes --prod/);
  assert.equal(workflow.split('  deploy-production:').length,2);
});
