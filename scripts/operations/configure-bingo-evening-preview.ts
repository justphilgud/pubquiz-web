import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkVercelGitPreview, type GitPreviewDeploymentInput } from "../deploy-vercel-git-preview";
import { BINGO_EVENING_REVIEW_DATABASE as originalReview, BINGO_COLOR_REVIEW_BRANCH, validateDeploymentEnvironment } from "../validate-deployment-environment";

const team = "team_BE4XNxNRwsaEnSb9N8FFvWEH";
const project = "prj_9Nnwer6B43P0nfrOZPIEygFWg666";
const keys = ["DATABASE_URL", "EXPECTED_DATABASE_HOST", "EXPECTED_DATABASE_NAME", "EXPECTED_DATABASE_BRANCH"];
type Variable = { id?: string; key: string; target?: string[]; gitBranch?: string; type?: string; visibility?: string; value?: string };

export function eveningPreviewVariables(environment: Record<string, string | undefined>) {
  const review={...originalReview,branch:environment.DEPLOYMENT_BRANCH===BINGO_COLOR_REVIEW_BRANCH?BINGO_COLOR_REVIEW_BRANCH:originalReview.branch};
  assert.equal(environment.DEPLOYMENT_BRANCH, review.branch);
  assert.equal(environment.DEPLOYMENT_EVENT, "workflow_dispatch");
  assert.equal(environment.VERCEL_ORG_ID, team);
  assert.equal(environment.VERCEL_PROJECT_ID, project);
  validateDeploymentEnvironment({
    deploymentEnvironment: environment.DEPLOYMENT_ENV,
    deploymentEvent: environment.DEPLOYMENT_EVENT,
    deploymentRef: environment.DEPLOYMENT_REF,
    deploymentRepository: environment.DEPLOYMENT_REPOSITORY,
    databaseUrl: environment.DATABASE_URL,
    expectedDatabaseHost: review.pooledHost,
    expectedDatabaseName: review.name,
    expectedDatabaseBranch: review.endpoint,
  });
  return [environment.DATABASE_URL!, review.pooledHost, review.name, review.endpoint].map((value, index) => ({
    key: keys[index], value, type: index === 0 ? "sensitive" : "encrypted",
    target: ["preview"], gitBranch: review.branch,
  }));
}

async function main() {
  const variables = eveningPreviewVariables(process.env);
  const review={...originalReview,branch:process.env.DEPLOYMENT_BRANCH===BINGO_COLOR_REVIEW_BRANCH?BINGO_COLOR_REVIEW_BRANCH:originalReview.branch};
  const input: GitPreviewDeploymentInput = {
    branch: review.branch, deploymentEnvironment: process.env.DEPLOYMENT_ENV,
    repository: process.env.DEPLOYMENT_REPOSITORY, repositoryId: process.env.DEPLOYMENT_REPOSITORY_ID,
    sha: process.env.DEPLOYMENT_SHA, teamId: team, projectId: project,
    token: process.env.VERCEL_TOKEN, trustedBranches: process.env.TRUSTED_PREVIEW_BRANCHES,
  };
  // Existing trust, remote HEAD, project/repository and central media checks precede all writes.
  await checkVercelGitPreview(input);
  const base = `https://api.vercel.com/v10/projects/${project}/env?teamId=${team}`;
  const request = async (url: string, body?: unknown) => {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw Error(`PREVIEW_CONFIGURATION_HTTP_${response.status}`);
    return response.json();
  };
  const read = async (): Promise<Variable[]> => {
    const response = await request(base + "&decrypt=false");
    return Array.isArray(response) ? response : response.envs;
  };
  const own = (variable: Variable) => variable.gitBranch === review.branch && keys.includes(variable.key);
  const before = await read();
  for (const variable of before.filter(own)) assert.deepEqual(variable.target, ["preview"]);
  const result = await request(base + "&upsert=true", variables);
  assert.equal(result.failed?.length ?? 0, 0, "PREVIEW_CONFIGURATION_PARTIAL_FAILURE");
  const after = await read();
  const snapshot = (values: Variable[]) => values.filter(v => !own(v)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  assert.deepEqual(snapshot(after), snapshot(before), "UNRELATED_ENVIRONMENT_METADATA_CHANGED");
  for (const key of keys) {
    const matches = after.filter(v => own(v) && v.key === key);
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].target, ["preview"]);
    assert.ok(key === "DATABASE_URL"
      ? matches[0].type === "sensitive" || (matches[0].type === "encrypted" && matches[0].visibility === "secret")
      : matches[0].type === "encrypted");
  }
  console.info("Four exact Bingo evening Preview database overrides verified; unrelated configuration preserved.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch(() => { console.error("BINGO_EVENING_PREVIEW_CONFIGURATION_FAILED; no deployment performed."); process.exitCode = 1; });
}
