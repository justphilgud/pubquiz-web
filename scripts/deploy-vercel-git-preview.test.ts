import assert from "node:assert/strict";
import test from "node:test";
import {
  deployVercelGitPreview,
  checkVercelGitPreview,
  GitPreviewDeploymentError,
  validateGitPreviewDeploymentInput,
  verifyPreviewEnvironmentConfiguration,
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
  trustedBranches: JSON.stringify([branch]),
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
  gitBranch: null,
  target: ["preview"],
  contentHint: { storeId: "store_VzfNwjccgkzhc9bi" },
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

    if (url.pathname === "/v10/projects/prj_preview/env") {
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

test("requires all six central Preview variables before deployment", async () => {
  const { fetchMock } = createSuccessfulFetch();
  const incompleteFetch = (async (
    input: URL | RequestInfo,
    init?: RequestInit,
  ) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );

    if (url.pathname === "/v10/projects/prj_preview/env") {
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


test("new branches inherit central Preview variables without branch configuration", () => {
  for (const newBranch of ["codex/new-a", "feature/new-b"]) {
    assert.doesNotThrow(() => verifyPreviewEnvironmentConfiguration({ envs: branchEnvironment }, newBranch));
  }
});

test("media overrides on any branch block deployment", () => {
  for (const key of deploymentEnvironmentKeys) {
    assert.throws(() => verifyPreviewEnvironmentConfiguration({ envs: [
      ...branchEnvironment, { key, gitBranch: branch, target: ["preview"], type: "encrypted" },
    ] }, branch), assertErrorCode("PREVIEW_MEDIA_OVERRIDE_FORBIDDEN"));
  }
});

test("ambiguous, cross-environment or wrong-type central variables fail closed", () => {
  for (const envs of [
    [...branchEnvironment, branchEnvironment[0]],
    branchEnvironment.map((v) => ({ ...v, target: ["preview", "development"] })),
    branchEnvironment.map((v) => ({ ...v, type: "plain" })),
  ]) {
    assert.throws(() => verifyPreviewEnvironmentConfiguration({ envs }, branch),
      assertErrorCode("PREVIEW_BRANCH_ENVIRONMENT_INVALID"));
  }
});

test("store integration metadata prevents Production credentials in Preview", () => {
  for (const storeId of [undefined, "store_bIx6H2j23vJzi240", "store_unknown"]) {
    const envs = branchEnvironment.map((v) => v.key === "BLOB_READ_WRITE_TOKEN"
      ? { ...v, contentHint: { storeId } } : v);
    assert.throws(() => verifyPreviewEnvironmentConfiguration({ envs }, branch),
      assertErrorCode("PREVIEW_MEDIA_STORE_MISMATCH"));
  }
  assert.throws(() => verifyPreviewEnvironmentConfiguration({ envs: [
    ...branchEnvironment, { key: "BLOB_READ_WRITE_TOKEN", type: "sensitive", target: ["production"],
      contentHint: { storeId: "store_VzfNwjccgkzhc9bi" } },
  ] }, branch), assertErrorCode("PRODUCTION_MEDIA_STORE_MISMATCH"));
});

test("preflight never accesses secret values and explicitly disables decryption", async () => {
  const envs = branchEnvironment.map((v) => Object.defineProperty({ ...v }, "value", {
    get() { throw new Error("Secret value accessed"); },
  }));
  assert.doesNotThrow(() => verifyPreviewEnvironmentConfiguration({ envs }, branch));
  const { fetchMock, requests } = createSuccessfulFetch();
  await deployVercelGitPreview(validInput, dependencies(fetchMock));
  const request = requests.find((r) => r.url.pathname.endsWith("/env"));
  assert.equal(request?.url.searchParams.get("decrypt"), "false");
  assert.equal(request?.url.searchParams.has("gitBranch"), false);
});


test("read-only preflight issues no deployment request", async () => {
  const { fetchMock, requests } = createSuccessfulFetch();
  await checkVercelGitPreview(validInput, dependencies(fetchMock));
  assert.equal(requests.length, 2);
  assert.equal(requests.some((r) => r.init?.method === "POST"), false);
});


test("unapproved branches cannot obtain any Vercel request even with successful CI", async () => {
  const { fetchMock, requests } = createSuccessfulFetch();
  for (const trustedBranches of [undefined, "[]", '["codex/*"]', '["other-branch"]']) {
    await assert.rejects(deployVercelGitPreview({ ...validInput, trustedBranches }, dependencies(fetchMock)), assertErrorCode("PREVIEW_BRANCH_NOT_TRUSTED"));
  }
  assert.equal(requests.length, 0);
});

test("central acceptance on a different branch does not consume existing legacy overrides", () => {
  const envs = [...branchEnvironment, ...branchEnvironment.map((v) => ({ ...v, gitBranch: branch }))];
  assert.doesNotThrow(() => verifyPreviewEnvironmentConfiguration({ envs }, "codex/preview-media-configuration"));
  assert.throws(() => verifyPreviewEnvironmentConfiguration({ envs }, branch), assertErrorCode("PREVIEW_MEDIA_OVERRIDE_FORBIDDEN"));
});

test("Vercel integration may expose the nonsecret store identity as plain config", () => {
  const integrated = branchEnvironment.map((variable) => variable.key === "BLOB_STORE_ID"
    ? { ...variable, type: "plain" } : variable);
  assert.doesNotThrow(() => verifyPreviewEnvironmentConfiguration({ envs: integrated }, branch));
  const wrongStore = integrated.map((variable) => variable.key === "BLOB_STORE_ID"
    ? { ...variable, contentHint: { storeId: "store_bIx6H2j23vJzi240" } } : variable);
  assert.throws(() => verifyPreviewEnvironmentConfiguration({ envs: wrongStore }, branch),
    (error: unknown) => error instanceof GitPreviewDeploymentError && error.code === "PREVIEW_MEDIA_STORE_MISMATCH");
  const plainToken = integrated.map((variable) => variable.key === "BLOB_READ_WRITE_TOKEN"
    ? { ...variable, type: "plain" } : variable);
  assert.throws(() => verifyPreviewEnvironmentConfiguration({ envs: plainToken }, branch),
    (error: unknown) => error instanceof GitPreviewDeploymentError && error.code === "PREVIEW_BRANCH_ENVIRONMENT_INVALID");
});