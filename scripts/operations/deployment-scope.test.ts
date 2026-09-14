import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { needsApplicationDeployment } from "./deployment-scope";
test("operations-only deployment exclusion never suppresses mixed application/schema/package changes", () => {
  const ops = ["scripts/operations/acceptance-cli.ts", ".github/workflows/ap94-acceptance.yml", ".github/workflows/deploy-production.yml"];
  assert.equal(needsApplicationDeployment(ops), false);
  for (const path of ["app/page.tsx", "prisma/schema.prisma", "package-lock.json", "next.config.ts", ".github/workflows/ci.yml", "scripts/deploy.ts"]) assert.equal(needsApplicationDeployment([...ops, path]), true);
});
test("production deployment requires scope job and retains environment review", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/deploy-production.yml", import.meta.url), "utf8");
  assert.match(workflow, /needs: deployment-scope/); assert.match(workflow, /needs.deployment-scope.outputs.required == 'true'/);
  assert.match(workflow, /environment: production/); assert.match(workflow, /fetch-depth: 2/);
});
