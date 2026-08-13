import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const VERCEL_API_BASE_URL = "https://api.vercel.com";
const EXPECTED_REPOSITORY = "justphilgud/pubquiz-web";
const REQUIRED_PREVIEW_ENVIRONMENT = {
  TEMPLATE_MEDIA_UPLOAD_ENABLED: "encrypted",
  MEDIA_UPLOAD_ENV: "encrypted",
  MEDIA_UPLOAD_STORE_ENV: "encrypted",
  BLOB_STORE_ID: "encrypted",
  BLOB_READ_WRITE_TOKEN: "sensitive",
  BLOB_WEBHOOK_PUBLIC_KEY: "encrypted",
} as const;

type PreviewEnvironmentKey = keyof typeof REQUIRED_PREVIEW_ENVIRONMENT;

export type GitPreviewDeploymentInput = Readonly<{
  branch?: string;
  deploymentEnvironment?: string;
  projectId?: string;
  repository?: string;
  repositoryId?: string;
  sha?: string;
  teamId?: string;
  token?: string;
}>;

type ValidatedGitPreviewDeploymentInput = Readonly<{
  branch: string;
  projectId: string;
  repository: string;
  repositoryId: number;
  sha: string;
  teamId: string;
  token: string;
}>;

type VercelProject = Readonly<{
  id: string;
  name: string;
  link?: Readonly<{
    org?: string;
    productionBranch?: string;
    repo?: string;
    repoId?: number | string;
    type?: string;
  }>;
}>;

type VercelEnvironmentVariable = Readonly<{
  gitBranch?: string | null;
  key?: string;
  target?: string[];
  type?: string;
}>;

type VercelEnvironmentResponse = Readonly<{
  envs?: VercelEnvironmentVariable[];
}>;

type VercelDeployment = Readonly<{
  build?: Readonly<{ env?: unknown }>;
  env?: unknown;
  gitSource?: Readonly<{
    ref?: string | null;
    sha?: string;
    type?: string;
  }>;
  id: string;
  meta?: Readonly<{
    githubCommitRef?: string;
    githubCommitSha?: string;
  }>;
  oidcTokenClaims?: Readonly<{ environment?: string }>;
  readyState?: string;
  status?: string;
  target?: string | null;
  url: string;
}>;

export type GitPreviewDeploymentSummary = Readonly<{
  branch: string;
  deploymentId: string;
  environment: "preview";
  environmentKeysVerified: PreviewEnvironmentKey[];
  sha: string;
  url: string;
}>;

type GitPreviewDeploymentDependencies = Readonly<{
  fetch: typeof fetch;
  maxPollAttempts: number;
  pollIntervalMs: number;
  readRemoteBranchHead: (branch: string) => string;
  sleep: (milliseconds: number) => Promise<void>;
}>;

export class GitPreviewDeploymentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GitPreviewDeploymentError";
  }
}

function requireValue(
  value: string | undefined,
  code: string,
  message: string,
) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new GitPreviewDeploymentError(code, message);
  }

  return normalized;
}

function validateBranch(branch: string) {
  const isUnsafe =
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) ||
    branch === "main" ||
    branch.endsWith("/") ||
    branch.endsWith(".lock") ||
    branch.includes("..") ||
    branch.includes("//") ||
    branch.includes("@{");

  if (isUnsafe) {
    throw new GitPreviewDeploymentError(
      "PREVIEW_BRANCH_INVALID",
      "Der Preview-Branch ist nicht zulässig.",
    );
  }

  return branch;
}

export function validateGitPreviewDeploymentInput(
  input: GitPreviewDeploymentInput,
): ValidatedGitPreviewDeploymentInput {
  if (input.deploymentEnvironment !== "preview") {
    throw new GitPreviewDeploymentError(
      "PREVIEW_ENVIRONMENT_INVALID",
      "Das Git-basierte Deployment darf ausschließlich Preview verwenden.",
    );
  }

  const repository = requireValue(
    input.repository,
    "DEPLOYMENT_REPOSITORY_MISSING",
    "DEPLOYMENT_REPOSITORY fehlt.",
  );

  if (repository !== EXPECTED_REPOSITORY) {
    throw new GitPreviewDeploymentError(
      "DEPLOYMENT_REPOSITORY_INVALID",
      "Das Deployment läuft nicht im freigegebenen Repository.",
    );
  }

  const sha = requireValue(
    input.sha,
    "DEPLOYMENT_SHA_MISSING",
    "DEPLOYMENT_SHA fehlt.",
  ).toLowerCase();

  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new GitPreviewDeploymentError(
      "DEPLOYMENT_SHA_INVALID",
      "DEPLOYMENT_SHA muss ein vollständiger Git-SHA sein.",
    );
  }

  const repositoryIdText = requireValue(
    input.repositoryId,
    "DEPLOYMENT_REPOSITORY_ID_MISSING",
    "DEPLOYMENT_REPOSITORY_ID fehlt.",
  );

  if (!/^[1-9][0-9]*$/.test(repositoryIdText)) {
    throw new GitPreviewDeploymentError(
      "DEPLOYMENT_REPOSITORY_ID_INVALID",
      "DEPLOYMENT_REPOSITORY_ID ist ungültig.",
    );
  }

  return {
    branch: validateBranch(
      requireValue(
        input.branch,
        "DEPLOYMENT_BRANCH_MISSING",
        "DEPLOYMENT_BRANCH fehlt.",
      ),
    ),
    projectId: requireValue(
      input.projectId,
      "VERCEL_PROJECT_ID_MISSING",
      "VERCEL_PROJECT_ID fehlt.",
    ),
    repository,
    repositoryId: Number(repositoryIdText),
    sha,
    teamId: requireValue(
      input.teamId,
      "VERCEL_ORG_ID_MISSING",
      "VERCEL_ORG_ID fehlt.",
    ),
    token: requireValue(
      input.token,
      "VERCEL_TOKEN_MISSING",
      "VERCEL_TOKEN fehlt.",
    ),
  };
}

export function readRemoteBranchHead(branch: string) {
  let output: string;

  try {
    output = execFileSync(
      "git",
      ["ls-remote", "--exit-code", "origin", `refs/heads/${branch}`],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    throw new GitPreviewDeploymentError(
      "REMOTE_BRANCH_LOOKUP_FAILED",
      "Der Remote-Preview-Branch konnte nicht sicher gelesen werden.",
    );
  }

  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  const [sha, ref] = lines[0]?.split(/\s+/) ?? [];

  if (
    lines.length !== 1 ||
    !sha ||
    !/^[0-9a-f]{40}$/i.test(sha) ||
    ref !== `refs/heads/${branch}`
  ) {
    throw new GitPreviewDeploymentError(
      "REMOTE_BRANCH_LOOKUP_INVALID",
      "Der Remote-Preview-Branch lieferte kein eindeutiges Ergebnis.",
    );
  }

  return sha.toLowerCase();
}

function buildApiUrl(
  path: string,
  parameters: Record<string, string>,
) {
  const url = new URL(path, VERCEL_API_BASE_URL);

  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }

  return url;
}

async function requestJson<T>(
  fetchImplementation: typeof fetch,
  url: URL,
  token: string,
  init: RequestInit | undefined,
  errorCode: string,
) {
  let response: Response;

  try {
    response = await fetchImplementation(url, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new GitPreviewDeploymentError(
      errorCode,
      "Die Vercel API war nicht erreichbar.",
    );
  }

  if (!response.ok) {
    throw new GitPreviewDeploymentError(
      errorCode,
      `Die Vercel API antwortete mit HTTP ${response.status}.`,
    );
  }

  return (await response.json()) as T;
}

function verifyProject(
  project: VercelProject,
  input: ValidatedGitPreviewDeploymentInput,
) {
  if (project.id !== input.projectId || !project.name) {
    throw new GitPreviewDeploymentError(
      "VERCEL_PROJECT_MISMATCH",
      "Das verknüpfte Vercel-Projekt stimmt nicht überein.",
    );
  }

  const link = project.link;
  const linkedRepository = `${link?.org ?? ""}/${link?.repo ?? ""}`;

  if (
    link?.type !== "github" ||
    Number(link.repoId) !== input.repositoryId ||
    linkedRepository !== input.repository
  ) {
    throw new GitPreviewDeploymentError(
      "VERCEL_GIT_LINK_MISMATCH",
      "Das Vercel-Projekt ist nicht mit dem freigegebenen GitHub-Repository verknüpft.",
    );
  }

  if (link.productionBranch === input.branch) {
    throw new GitPreviewDeploymentError(
      "PREVIEW_BRANCH_IS_PRODUCTION",
      "Der Preview-Branch darf nicht der Vercel-Production-Branch sein.",
    );
  }
}

function verifyPreviewEnvironmentConfiguration(
  response: VercelEnvironmentResponse,
  branch: string,
) {
  const variables = response.envs ?? [];

  for (const [key, expectedType] of Object.entries(
    REQUIRED_PREVIEW_ENVIRONMENT,
  ) as [PreviewEnvironmentKey, string][]) {
    const matches = variables.filter(
      (variable) =>
        variable.key === key &&
        variable.gitBranch === branch &&
        variable.target?.includes("preview"),
    );

    if (matches.length !== 1 || matches[0]?.type !== expectedType) {
      throw new GitPreviewDeploymentError(
        "PREVIEW_BRANCH_ENVIRONMENT_INVALID",
        `Die branch-spezifische Preview-Konfiguration für ${key} fehlt oder ist nicht eindeutig.`,
      );
    }
  }
}

function verifyDeploymentSource(
  deployment: VercelDeployment,
  input: ValidatedGitPreviewDeploymentInput,
) {
  if (
    deployment.gitSource?.type !== "github" ||
    deployment.gitSource.ref !== input.branch ||
    deployment.gitSource.sha?.toLowerCase() !== input.sha
  ) {
    throw new GitPreviewDeploymentError(
      "DEPLOYED_GIT_SOURCE_MISMATCH",
      "Vercel hat nicht den freigegebenen Branch und SHA übernommen.",
    );
  }
}

function extractEnvironmentKeys(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (value && typeof value === "object") {
    return Object.keys(value);
  }

  return [];
}

function verifyReadyDeployment(
  deployment: VercelDeployment,
  input: ValidatedGitPreviewDeploymentInput,
) {
  verifyDeploymentSource(deployment, input);

  if (
    deployment.target === "production" ||
    deployment.oidcTokenClaims?.environment !== "preview"
  ) {
    throw new GitPreviewDeploymentError(
      "DEPLOYED_ENVIRONMENT_INVALID",
      "Das Git-basierte Deployment wurde nicht als Preview aufgelöst.",
    );
  }

  if (
    deployment.meta?.githubCommitRef !== input.branch ||
    deployment.meta.githubCommitSha?.toLowerCase() !== input.sha
  ) {
    throw new GitPreviewDeploymentError(
      "DEPLOYED_GIT_METADATA_MISMATCH",
      "Die registrierten Vercel-Git-Metadaten stimmen nicht überein.",
    );
  }

  const environmentKeys = new Set([
    ...extractEnvironmentKeys(deployment.env),
    ...extractEnvironmentKeys(deployment.build?.env),
  ]);

  for (const key of Object.keys(
    REQUIRED_PREVIEW_ENVIRONMENT,
  ) as PreviewEnvironmentKey[]) {
    if (!environmentKeys.has(key)) {
      throw new GitPreviewDeploymentError(
        "DEPLOYED_ENVIRONMENT_KEY_MISSING",
        `Die erwartete Preview-Variable ${key} fehlt im Deploymentkontext.`,
      );
    }
  }
}

function normalizeDeploymentUrl(url: string) {
  const normalized = url.startsWith("https://") ? url : `https://${url}`;
  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new GitPreviewDeploymentError(
      "DEPLOYMENT_URL_INVALID",
      "Vercel lieferte keine gültige Deployment-URL.",
    );
  }

  if (parsed.protocol !== "https:" || parsed.pathname !== "/") {
    throw new GitPreviewDeploymentError(
      "DEPLOYMENT_URL_INVALID",
      "Vercel lieferte keine sichere Deployment-URL.",
    );
  }

  return parsed.origin;
}

const defaultDependencies: GitPreviewDeploymentDependencies = {
  fetch,
  maxPollAttempts: 240,
  pollIntervalMs: 5_000,
  readRemoteBranchHead,
  sleep: (milliseconds) =>
    new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
};

export async function deployVercelGitPreview(
  rawInput: GitPreviewDeploymentInput,
  dependencyOverrides: Partial<GitPreviewDeploymentDependencies> = {},
): Promise<GitPreviewDeploymentSummary> {
  const input = validateGitPreviewDeploymentInput(rawInput);
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const remoteSha = dependencies.readRemoteBranchHead(input.branch).toLowerCase();

  if (remoteSha !== input.sha) {
    throw new GitPreviewDeploymentError(
      "REMOTE_BRANCH_SHA_MISMATCH",
      "Der Preview-Branch hat sich seit dem erfolgreichen CI-Lauf verändert.",
    );
  }

  const commonParameters = { teamId: input.teamId };
  const project = await requestJson<VercelProject>(
    dependencies.fetch,
    buildApiUrl(`/v9/projects/${encodeURIComponent(input.projectId)}`, commonParameters),
    input.token,
    undefined,
    "VERCEL_PROJECT_LOOKUP_FAILED",
  );

  verifyProject(project, input);

  const environment = await requestJson<VercelEnvironmentResponse>(
    dependencies.fetch,
    buildApiUrl(
      `/v9/projects/${encodeURIComponent(input.projectId)}/env`,
      { ...commonParameters, gitBranch: input.branch },
    ),
    input.token,
    undefined,
    "VERCEL_ENVIRONMENT_LOOKUP_FAILED",
  );

  verifyPreviewEnvironmentConfiguration(environment, input.branch);

  const deployment = await requestJson<VercelDeployment>(
    dependencies.fetch,
    buildApiUrl("/v13/deployments", {
      ...commonParameters,
      forceNew: "1",
      skipAutoDetectionConfirmation: "1",
    }),
    input.token,
    {
      body: JSON.stringify({
        gitSource: {
          ref: input.branch,
          repoId: input.repositoryId,
          sha: input.sha,
          type: "github",
        },
        name: project.name,
        project: input.projectId,
      }),
      method: "POST",
    },
    "VERCEL_DEPLOYMENT_CREATE_FAILED",
  );

  verifyDeploymentSource(deployment, input);

  let currentDeployment = deployment;

  for (let attempt = 0; attempt < dependencies.maxPollAttempts; attempt += 1) {
    const state = currentDeployment.readyState ?? currentDeployment.status;

    if (state === "READY") {
      verifyReadyDeployment(currentDeployment, input);

      return {
        branch: input.branch,
        deploymentId: currentDeployment.id,
        environment: "preview",
        environmentKeysVerified: Object.keys(
          REQUIRED_PREVIEW_ENVIRONMENT,
        ) as PreviewEnvironmentKey[],
        sha: input.sha,
        url: normalizeDeploymentUrl(currentDeployment.url),
      };
    }

    if (state === "ERROR" || state === "CANCELED") {
      throw new GitPreviewDeploymentError(
        "VERCEL_DEPLOYMENT_FAILED",
        `Das Vercel-Deployment endete mit Status ${state}.`,
      );
    }

    await dependencies.sleep(dependencies.pollIntervalMs);
    currentDeployment = await requestJson<VercelDeployment>(
      dependencies.fetch,
      buildApiUrl(
        `/v13/deployments/${encodeURIComponent(currentDeployment.id)}`,
        commonParameters,
      ),
      input.token,
      undefined,
      "VERCEL_DEPLOYMENT_STATUS_FAILED",
    );
  }

  throw new GitPreviewDeploymentError(
    "VERCEL_DEPLOYMENT_TIMEOUT",
    "Das Vercel-Deployment erreichte nicht rechtzeitig einen Endstatus.",
  );
}

function inputFromEnvironment(): GitPreviewDeploymentInput {
  return {
    branch: process.env.DEPLOYMENT_BRANCH,
    deploymentEnvironment: process.env.DEPLOYMENT_ENV,
    projectId: process.env.VERCEL_PROJECT_ID,
    repository: process.env.DEPLOYMENT_REPOSITORY,
    repositoryId: process.env.DEPLOYMENT_REPOSITORY_ID,
    sha: process.env.DEPLOYMENT_SHA,
    teamId: process.env.VERCEL_ORG_ID,
    token: process.env.VERCEL_TOKEN,
  };
}

async function main() {
  try {
    const summary = await deployVercelGitPreview(inputFromEnvironment());
    const githubOutput = process.env.GITHUB_OUTPUT;

    if (!githubOutput) {
      throw new GitPreviewDeploymentError(
        "GITHUB_OUTPUT_MISSING",
        "GITHUB_OUTPUT fehlt.",
      );
    }

    appendFileSync(
      githubOutput,
      `url=${summary.url}\ndeployment_id=${summary.deploymentId}\n`,
      "utf8",
    );

    console.log("Vercel Git Preview: READY");
    console.log(`Branch: ${summary.branch}`);
    console.log(`Commit: ${summary.sha}`);
    console.log(`Environment: ${summary.environment}`);
    console.log(`Deployment: ${summary.url}`);
    console.log(
      `Branch environment keys verified: ${summary.environmentKeysVerified.length}`,
    );
  } catch (error) {
    const safeError =
      error instanceof GitPreviewDeploymentError
        ? `${error.code}: ${error.message}`
        : "VERCEL_GIT_PREVIEW_FAILED: Das Git-basierte Preview-Deployment ist fehlgeschlagen.";

    console.error(safeError);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (entryPoint === import.meta.url) {
  void main();
}
