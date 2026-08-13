import assert from "node:assert/strict";
import test from "node:test";
import {
  deployVercelGitPreview,
  GitPreviewDeploymentError,
  validateGitPreviewDeploymentInput,
} from "./deploy-vercel-git-preview";

const branch = "preview/content-and-quiz-flow";
const sha = "a".repeat(40);

const validInput = {
  branch,
  deploymentEnvironment: "preview",
  projectId: "prj_preview",
  repository: "justphilgud/pubquiz-web",
  repositoryId: "1253336192",
  sha,
  teamId: "team_preview",
  token: "vercel-test-token",
} as const;

const branchEnvironment = [
  { key: "TEMPLATE_MEDIA_UPLOAD_ENABLED", type: "encrypted" },
  { key: "MEDIA_UPLOAD_ENV", type: "encrypted" },
  { key: "MEDIA_UPLOAD_STORE_ENV", type: "encrypted" },
  { key: "BLOB_STORE_ID", type: "encrypted" },
  { key: "BLOB_READ_WRITE_TOKEN", type: "sensitive" },
  { key: "BLOB_WEBHOOK_PUBLIC_KEY", type: "encrypted" },
].map((variable) => ({
  ...variable,
  gitBranch: branch,
  target: ["preview"],
}));

const deploymentEnvironmentKeys = branchEnvironment.map(
  (variable) => variable.key,
);

function deployment(
  state: "INITIALIZING" | "READY",
  overrides: Record<string, unknown> = {},
) {
  return {
    build: { env: deploymentEnvironmentKeys },
    env: deploymentEnvironmentKeys,
    gitSource: { ref: branch, sha, type: "github" },
    id: "dpl_preview",
    meta: { githubCommitRef: branch, githubCommitSha: sha },
    oidcTokenClaims: { environment: "preview" },
    readyState: state,
    status: state,
    target: null,
    url: "pubquiz-preview.example.vercel.app",
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function createSuccessfulFetch(
  readyDeployment = deployment("READY"),
) {
  const requests: { init?: RequestInit; url: URL }[] = [];

  const fetchMock = (async (
    input: URL | RequestInfo,
    init?: RequestInit,
  ) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    requests.push({ init, url });

    if (url.pathname === "/v9/projects/prj_preview") {
      return jsonResponse({
        id: "prj_preview",
        link: {
          org: "justphilgud",
          productionBranch: "main",
          repo: "pubquiz-web",
          repoId: 1253336192,
          type: "github",
        },
        name: "pubquiz-web",
      });
    }

    if (url.pathname === "/v9/projects/prj_preview/env") {
      return jsonResponse({ envs: branchEnvironment });
    }

    if (url.pathname === "/v13/deployments" && init?.method === "POST") {
      return jsonResponse(deployment("INITIALIZING"));
    }

    if (url.pathname === "/v13/deployments/dpl_preview") {
      return jsonResponse(readyDeployment);
    }

    return jsonResponse({ error: "unexpected request" }, 404);
  }) as typeof fetch;

  return { fetchMock, requests };
}

function dependencies(fetchMock: typeof fetch) {
  return {
    fetch: fetchMock,
    maxPollAttempts: 2,
    pollIntervalMs: 0,
    readRemoteBranchHead: () => sha,
    sleep: async () => undefined,
  };
}

function assertErrorCode(code: string) {
  return (error: unknown) =>
    error instanceof GitPreviewDeploymentError && error.code === code;
}

test("deploys the exact tested SHA as a targeted Git preview", async () => {
  const { fetchMock, requests } = createSuccessfulFetch();
  const summary = await deployVercelGitPreview(
    validInput,
    dependencies(fetchMock),
  );

  assert.equal(summary.sha, sha);
  assert.equal(summary.branch, branch);
  assert.equal(summary.environment, "preview");
  assert.equal(
    summary.url,
    "https://pubquiz-preview.example.vercel.app",
  );
  assert.equal(summary.environmentKeysVerified.length, 6);

  const createRequest = requests.find(
    (request) =>
      request.url.pathname === "/v13/deployments" &&
      request.init?.method === "POST",
  );
  assert.ok(createRequest);
  assert.equal(createRequest.url.searchParams.get("forceNew"), "1");

  const body = JSON.parse(String(createRequest.init?.body)) as {
    gitSource: { ref: string; repoId: number; sha: string; type: string };
    target?: string;
  };
  assert.deepEqual(body.gitSource, {
    ref: branch,
    repoId: 1253336192,
    sha,
    type: "github",
  });
  assert.equal(body.target, undefined);
});

test("aborts before Vercel when the remote branch moved past the tested SHA", async () => {
  let requestCount = 0;
  const fetchMock = (async () => {
    requestCount += 1;
    return jsonResponse({});
  }) as typeof fetch;

  await assert.rejects(
    deployVercelGitPreview(validInput, {
      ...dependencies(fetchMock),
      readRemoteBranchHead: () => "b".repeat(40),
    }),
    assertErrorCode("REMOTE_BRANCH_SHA_MISMATCH"),
  );
  assert.equal(requestCount, 0);
});

test("rejects main and every non-preview deployment environment", () => {
  assert.throws(
    () =>
      validateGitPreviewDeploymentInput({
        ...validInput,
        branch: "main",
      }),
    assertErrorCode("PREVIEW_BRANCH_INVALID"),
  );
  assert.throws(
    () =>
      validateGitPreviewDeploymentInput({
        ...validInput,
        deploymentEnvironment: "production",
      }),
    assertErrorCode("PREVIEW_ENVIRONMENT_INVALID"),
  );
});

test("requires all six branch-specific Preview variables before deployment", async () => {
  const { fetchMock } = createSuccessfulFetch();
  const incompleteFetch = (async (
    input: URL | RequestInfo,
    init?: RequestInit,
  ) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );

    if (url.pathname === "/v9/projects/prj_preview/env") {
      return jsonResponse({ envs: branchEnvironment.slice(1) });
    }

    return fetchMock(input, init);
  }) as typeof fetch;

  await assert.rejects(
    deployVercelGitPreview(validInput, dependencies(incompleteFetch)),
    assertErrorCode("PREVIEW_BRANCH_ENVIRONMENT_INVALID"),
  );
});

test("rejects a ready deployment with mismatching Git metadata", async () => {
  const { fetchMock } = createSuccessfulFetch(
    deployment("READY", {
      meta: { githubCommitRef: "HEAD", githubCommitSha: sha },
    }),
  );

  await assert.rejects(
    deployVercelGitPreview(validInput, dependencies(fetchMock)),
    assertErrorCode("DEPLOYED_GIT_METADATA_MISMATCH"),
  );
});

test("rejects a deployment resolved as Production", async () => {
  const { fetchMock } = createSuccessfulFetch(
    deployment("READY", {
      oidcTokenClaims: { environment: "production" },
      target: "production",
    }),
  );

  await assert.rejects(
    deployVercelGitPreview(validInput, dependencies(fetchMock)),
    assertErrorCode("DEPLOYED_ENVIRONMENT_INVALID"),
  );
});
