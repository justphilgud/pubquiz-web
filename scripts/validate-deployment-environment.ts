import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { processEnv } from "@next/env";

export const EXPECTED_REPOSITORY = "justphilgud/pubquiz-web";

export type DeploymentEnvironment = "preview" | "production";

export type DeploymentValidationInput = Readonly<{
  deploymentEnvironment?: string;
  deploymentEvent?: string;
  deploymentRef?: string;
  deploymentRepository?: string;
  databaseUrl?: string;
  expectedDatabaseBranch?: string;
  expectedDatabaseHost?: string;
  expectedDatabaseName?: string;
}>;

export type SafeDeploymentSummary = Readonly<{
  environment: Uppercase<DeploymentEnvironment>;
  repository: string;
  branch: string;
  databaseHost: string;
  databaseName: string;
  databaseBranchVerified: boolean;
}>;

export class DeploymentValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeploymentValidationError";
  }
}

function requireValue(value: string | undefined, code: string, message: string) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new DeploymentValidationError(code, message);
  }

  return normalized;
}

function parseEnvironment(value: string | undefined): DeploymentEnvironment {
  if (value === "preview" || value === "production") {
    return value;
  }

  throw new DeploymentValidationError(
    "DEPLOYMENT_ENV_INVALID",
    "DEPLOYMENT_ENV muss exakt preview oder production sein.",
  );
}

function parseDatabaseUrl(value: string | undefined) {
  const databaseUrl = requireValue(
    value,
    "DATABASE_URL_MISSING",
    "DATABASE_URL fehlt.",
  );

  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new DeploymentValidationError(
      "DATABASE_URL_INVALID",
      "DATABASE_URL ist keine gültige URL.",
    );
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new DeploymentValidationError(
      "DATABASE_PROTOCOL_INVALID",
      "DATABASE_URL muss PostgreSQL verwenden.",
    );
  }

  let databaseName: string;

  try {
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    throw new DeploymentValidationError(
      "DATABASE_NAME_INVALID",
      "Der Datenbankname in DATABASE_URL ist ungültig.",
    );
  }

  if (!parsed.hostname || !databaseName || databaseName.includes("/")) {
    throw new DeploymentValidationError(
      "DATABASE_IDENTITY_INVALID",
      "Host und Datenbankname müssen eindeutig parsebar sein.",
    );
  }

  return {
    host: parsed.hostname.toLowerCase(),
    name: databaseName,
  };
}

function validateExecutionContext(
  environment: DeploymentEnvironment,
  input: DeploymentValidationInput,
) {
  const repository = requireValue(
    input.deploymentRepository,
    "DEPLOYMENT_REPOSITORY_MISSING",
    "DEPLOYMENT_REPOSITORY fehlt.",
  );
  const ref = requireValue(
    input.deploymentRef,
    "DEPLOYMENT_REF_MISSING",
    "DEPLOYMENT_REF fehlt.",
  );
  const event = requireValue(
    input.deploymentEvent,
    "DEPLOYMENT_EVENT_MISSING",
    "DEPLOYMENT_EVENT fehlt.",
  );

  if (repository !== EXPECTED_REPOSITORY) {
    throw new DeploymentValidationError(
      "DEPLOYMENT_REPOSITORY_INVALID",
      "Das Deployment läuft nicht im freigegebenen Repository.",
    );
  }

  if (event !== "push" && event !== "workflow_dispatch") {
    throw new DeploymentValidationError(
      "DEPLOYMENT_EVENT_INVALID",
      "Deployments sind nur nach einem Push oder einem autorisierten manuellen Start erlaubt.",
    );
  }

  if (environment === "production" && ref !== "refs/heads/main") {
    throw new DeploymentValidationError(
      "PRODUCTION_REF_INVALID",
      "Production darf ausschließlich von main deployt werden.",
    );
  }

  if (environment === "preview" && ref === "refs/heads/main") {
    throw new DeploymentValidationError(
      "PREVIEW_REF_INVALID",
      "main darf nicht in die Preview-Umgebung deployt werden.",
    );
  }

  if (!ref.startsWith("refs/heads/")) {
    throw new DeploymentValidationError(
      "DEPLOYMENT_REF_INVALID",
      "Deployments sind ausschließlich von Branches erlaubt.",
    );
  }

  return { repository, ref };
}

export function validateDeploymentEnvironment(
  input: DeploymentValidationInput,
): SafeDeploymentSummary {
  const environment = parseEnvironment(input.deploymentEnvironment);
  const context = validateExecutionContext(environment, input);
  const database = parseDatabaseUrl(input.databaseUrl);
  const expectedHost = requireValue(
    input.expectedDatabaseHost,
    "EXPECTED_DATABASE_HOST_MISSING",
    "EXPECTED_DATABASE_HOST fehlt.",
  ).toLowerCase();
  const expectedName = requireValue(
    input.expectedDatabaseName,
    "EXPECTED_DATABASE_NAME_MISSING",
    "EXPECTED_DATABASE_NAME fehlt.",
  );

  if (database.host !== expectedHost) {
    throw new DeploymentValidationError(
      "DATABASE_HOST_MISMATCH",
      "Der Datenbankhost entspricht nicht der freigegebenen Umgebung.",
    );
  }

  if (database.name !== expectedName) {
    throw new DeploymentValidationError(
      "DATABASE_NAME_MISMATCH",
      "Der Datenbankname entspricht nicht der freigegebenen Umgebung.",
    );
  }

  const expectedBranch = input.expectedDatabaseBranch?.trim().toLowerCase();

  if (expectedBranch && !database.host.includes(expectedBranch)) {
    throw new DeploymentValidationError(
      "DATABASE_BRANCH_MISMATCH",
      "Die Datenbank-Branch- oder Endpoint-Kennung wurde im Host nicht gefunden.",
    );
  }

  return {
    environment: environment.toUpperCase() as Uppercase<DeploymentEnvironment>,
    repository: context.repository,
    branch: context.ref.slice("refs/heads/".length),
    databaseHost: database.host,
    databaseName: database.name,
    databaseBranchVerified: Boolean(expectedBranch),
  };
}

export function readDatabaseUrlFromEnvironmentFile(envFilePath: string) {
  const loadedFile = {
    path: envFilePath,
    contents: readFileSync(resolve(envFilePath), "utf8"),
    env: {} as Record<string, string | undefined>,
  };
  const inheritedDatabaseUrl = process.env.DATABASE_URL;

  delete process.env.DATABASE_URL;
  try {
    processEnv(
      [loadedFile],
      process.cwd(),
      { info() {}, error() {} },
      true,
    );
    return loadedFile.env.DATABASE_URL;
  } finally {
    if (inheritedDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = inheritedDatabaseUrl;
    }
  }
}

function environmentFromProcess(envFilePath?: string): DeploymentValidationInput {
  const databaseUrl = envFilePath
    ? readDatabaseUrlFromEnvironmentFile(envFilePath)
    : process.env.DATABASE_URL;

  return {
    deploymentEnvironment: process.env.DEPLOYMENT_ENV,
    deploymentEvent: process.env.DEPLOYMENT_EVENT,
    deploymentRef: process.env.DEPLOYMENT_REF,
    deploymentRepository: process.env.DEPLOYMENT_REPOSITORY,
    databaseUrl,
    expectedDatabaseBranch: process.env.EXPECTED_DATABASE_BRANCH,
    expectedDatabaseHost: process.env.EXPECTED_DATABASE_HOST,
    expectedDatabaseName: process.env.EXPECTED_DATABASE_NAME,
  };
}

function main() {
  const envFileArgument = process.argv.find((argument) =>
    argument.startsWith("--env-file="),
  );
  const envFilePath = envFileArgument?.slice("--env-file=".length);

  try {
    const summary = validateDeploymentEnvironment(
      environmentFromProcess(envFilePath),
    );

    console.log(`Environment: ${summary.environment}`);
    console.log(`Repository: ${summary.repository}`);
    console.log(`Branch: ${summary.branch}`);
    console.log(`Database host: ${summary.databaseHost}`);
    console.log(`Database name: ${summary.databaseName}`);
    console.log(
      `Database branch/endpoint check: ${summary.databaseBranchVerified ? "verified" : "not configured"}`,
    );
  } catch (error) {
    const safeError =
      error instanceof DeploymentValidationError
        ? `${error.code}: ${error.message}`
        : "DEPLOYMENT_VALIDATION_FAILED: Die Deployment-Umgebung konnte nicht validiert werden.";

    console.error(safeError);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (entryPoint === import.meta.url) {
  main();
}
