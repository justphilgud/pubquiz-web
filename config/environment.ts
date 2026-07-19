import type { BlobEnvironmentPrefix } from "../app/lib/blobPath";

export type LogicalEnvironment = "development" | "preview" | "production";

export type EnvironmentValidation = {
  name: string;
  ok: boolean;
  required: boolean;
  message: string;
};

export class EnvironmentConfigurationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EnvironmentConfigurationError";
  }
}

export type DatabaseConnectionInfo = {
  host: string;
  database: string;
  schema: string;
};

export function getDatabaseConnectionInfo(value = process.env.DATABASE_URL): DatabaseConnectionInfo {
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new EnvironmentConfigurationError("DATABASE_URL_INVALID", "DATABASE_URL ist keine gültige URL.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new EnvironmentConfigurationError("DATABASE_URL_INVALID", "DATABASE_URL muss PostgreSQL verwenden.");
  }
  return {
    host: url.hostname,
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "(default)",
    schema: url.searchParams.get("schema") || "pubquiz",
  };
}

export function getSafeEnvironmentSummary() {
  const database = getDatabaseConnectionInfo();
  return {
    environment: getLogicalEnvironment(),
    databaseHost: database.host,
    databaseName: database.database,
    databaseSchema: database.schema,
    blobPrefix: getBlobEnvironmentPrefix(),
  };
}

function parseLogicalEnvironment(value: string): LogicalEnvironment | null {
  return value === "development" ||
    value === "preview" ||
    value === "production"
    ? value
    : null;
}

export function getLogicalEnvironment(): LogicalEnvironment {
  const explicitEnvironment = process.env.MEDIA_UPLOAD_ENV;

  if (explicitEnvironment) {
    const parsed = parseLogicalEnvironment(explicitEnvironment);

    if (!parsed) {
      throw new EnvironmentConfigurationError(
        "MEDIA_UPLOAD_ENV_INVALID",
        "MEDIA_UPLOAD_ENV muss development, preview oder production sein.",
      );
    }

    return parsed;
  }

  const vercelEnvironment = process.env.VERCEL_ENV;

  if (vercelEnvironment) {
    const parsed = parseLogicalEnvironment(vercelEnvironment);

    if (!parsed) {
      throw new EnvironmentConfigurationError(
        "VERCEL_ENV_INVALID",
        "VERCEL_ENV ist für diese Anwendung ungültig.",
      );
    }

    return parsed;
  }

  if (process.env.NODE_ENV === "production") {
    return "production";
  }

  return "development";
}

export function getBlobEnvironmentPrefix(
  environment = getLogicalEnvironment(),
): BlobEnvironmentPrefix {
  if (environment === "production") {
    return "prod";
  }

  return environment === "preview" ? "preview" : "dev";
}

export function getBlobReadWriteToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new EnvironmentConfigurationError(
      "BLOB_READ_WRITE_TOKEN_MISSING",
      "BLOB_READ_WRITE_TOKEN fehlt in der Server-Umgebung.",
    );
  }

  return token;
}

function hasValidDatabaseUrl() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
}

function hasValidOptionalAuthUrl() {
  const value = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateBaseEnvironment(): EnvironmentValidation[] {
  let logicalEnvironmentValid = true;

  try {
    getLogicalEnvironment();
  } catch {
    logicalEnvironmentValid = false;
  }

  return [
    {
      name: "DATABASE_URL",
      ok: hasValidDatabaseUrl(),
      required: true,
      message: "gültige PostgreSQL-Verbindungs-URL vorhanden",
    },
    {
      name: "AUTH_SECRET",
      ok: Boolean(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET),
      required: true,
      message: "AUTH_SECRET oder NEXTAUTH_SECRET vorhanden",
    },
    {
      name: "AUTH_URL",
      ok: hasValidOptionalAuthUrl(),
      required: false,
      message: "optional gesetzte Auth-URL ist gültig",
    },
    {
      name: "LOGICAL_ENVIRONMENT",
      ok: logicalEnvironmentValid,
      required: true,
      message: "development, preview oder production auflösbar",
    },
    {
      name: "BLOB_PREFIX",
      ok: logicalEnvironmentValid,
      required: true,
      message: logicalEnvironmentValid
        ? `Präfix ${getBlobEnvironmentPrefix()} auflösbar`
        : "Präfix nicht auflösbar",
    },
  ];
}

export function validateUploadEnvironment(): EnvironmentValidation[] {
  return [
    ...validateBaseEnvironment(),
    {
      name: "BLOB_READ_WRITE_TOKEN",
      ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      required: true,
      message: "explizites Blob Read/Write-Credential vorhanden",
    },
  ];
}

export function assertBaseEnvironment() {
  const failure = validateBaseEnvironment().find(
    (result) => result.required && !result.ok,
  );

  if (failure) {
    throw new EnvironmentConfigurationError(
      `${failure.name}_INVALID`,
      `${failure.name} fehlt oder ist ungültig.`,
    );
  }
}
