import "server-only";

export type MediaUploadEnvironment = "dev" | "preview" | "prod";

type BlobAuthentication =
  | { token: string }
  | { oidcToken: string; storeId: string };

export type MediaUploadAuthenticationKind =
  | "BLOB_READ_WRITE_TOKEN"
  | "VERCEL_OIDC_TOKEN";

export type MediaUploadFailureDetails = {
  code: string;
  errorClass: string;
  sanitizedMessage: string;
  publicMessage: string;
};

export type MediaUploadServerConfig = {
  environment: MediaUploadEnvironment;
  pathnamePrefix: string;
  blobAuthentication: BlobAuthentication;
  webhookPublicKey: string;
};

export class MediaUploadConfigurationError extends Error {
  constructor(
    public readonly code: string,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "MediaUploadConfigurationError";
  }
}

function parseEnvironment(value: string): MediaUploadEnvironment | null {
  if (value === "production" || value === "prod") {
    return "prod";
  }

  if (value === "preview") {
    return "preview";
  }

  if (value === "development" || value === "dev") {
    return "dev";
  }

  return null;
}

export function getMediaUploadAuthenticationDiagnostics() {
  const blobReadWriteTokenPresent = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN,
  );
  const vercelOidcTokenPresent = Boolean(process.env.VERCEL_OIDC_TOKEN);
  const blobStoreIdPresent = Boolean(process.env.BLOB_STORE_ID);
  const oidcExpiry = process.env.VERCEL_OIDC_TOKEN
    ? getOidcExpiry(process.env.VERCEL_OIDC_TOKEN)
    : null;
  const vercelOidcTokenUsable = Boolean(
    oidcExpiry && oidcExpiry > Date.now() + 60_000 && blobStoreIdPresent,
  );
  const isVercelRuntime = Boolean(
    process.env.VERCEL_ENV || process.env.VERCEL === "1",
  );
  const preferredAuthenticationKind: MediaUploadAuthenticationKind =
    isVercelRuntime ? "VERCEL_OIDC_TOKEN" : "BLOB_READ_WRITE_TOKEN";
  const authenticationKind: MediaUploadAuthenticationKind =
    isVercelRuntime && vercelOidcTokenUsable
      ? "VERCEL_OIDC_TOKEN"
      : blobReadWriteTokenPresent
      ? "BLOB_READ_WRITE_TOKEN"
      : vercelOidcTokenPresent
        ? "VERCEL_OIDC_TOKEN"
        : preferredAuthenticationKind;

  return {
    authenticationKind,
    authenticationVariablePresent:
      authenticationKind === "BLOB_READ_WRITE_TOKEN"
        ? blobReadWriteTokenPresent
        : vercelOidcTokenPresent,
    preferredAuthenticationKind,
    blobReadWriteTokenPresent,
    vercelOidcTokenPresent,
    vercelOidcTokenUsable,
    blobStoreIdPresent,
    isVercelRuntime,
    vercelEnvironmentPresent: Boolean(process.env.VERCEL_ENV),
    vercelEnvironmentRecognized: process.env.VERCEL_ENV
      ? parseEnvironment(process.env.VERCEL_ENV) !== null
      : null,
    mediaUploadEnvironmentPresent: Boolean(process.env.MEDIA_UPLOAD_ENV),
    mediaUploadEnvironmentRecognized: process.env.MEDIA_UPLOAD_ENV
      ? parseEnvironment(process.env.MEDIA_UPLOAD_ENV) !== null
      : null,
  };
}

export function getMediaUploadEnvironment(): MediaUploadEnvironment {
  const vercelEnvironment = process.env.VERCEL_ENV;

  if (vercelEnvironment) {
    const parsed = parseEnvironment(vercelEnvironment);

    if (!parsed) {
      throw new MediaUploadConfigurationError(
        "UNSUPPORTED_VERCEL_ENV",
        "Die Vercel-Umgebung für Medien-Uploads ist ungültig.",
      );
    }

    return parsed;
  }

  const configuredEnvironment = process.env.MEDIA_UPLOAD_ENV;

  if (configuredEnvironment) {
    const parsed = parseEnvironment(configuredEnvironment);

    if (!parsed) {
      throw new MediaUploadConfigurationError(
        "UNSUPPORTED_MEDIA_UPLOAD_ENV",
        "MEDIA_UPLOAD_ENV muss dev, preview oder prod sein.",
      );
    }

    return parsed;
  }

  return process.env.NODE_ENV === "production" ? "prod" : "dev";
}

export function getMediaUploadPathnamePrefix() {
  return `question-media/${getMediaUploadEnvironment()}/`;
}

function validateApplicationConfiguration() {
  if (!process.env.AUTH_SECRET) {
    throw new MediaUploadConfigurationError(
      "AUTH_SECRET_MISSING",
      "AUTH_SECRET fehlt in der Server-Umgebung.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL;

  try {
    const url = new URL(databaseUrl ?? "");

    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Error("Unsupported database protocol");
    }
  } catch {
    throw new MediaUploadConfigurationError(
      "DATABASE_URL_INVALID",
      "DATABASE_URL fehlt oder ist ungültig.",
    );
  }

  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

  if (authUrl) {
    try {
      const url = new URL(authUrl);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Unsupported application URL protocol");
      }
    } catch {
      throw new MediaUploadConfigurationError(
        "AUTH_URL_INVALID",
        "AUTH_URL beziehungsweise NEXTAUTH_URL ist ungültig.",
      );
    }
  }
}

function getOidcExpiry(token: string) {
  try {
    const payload = token.split(".")[1];
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    const expiry =
      decoded && typeof decoded === "object" ? Reflect.get(decoded, "exp") : null;

    return typeof expiry === "number" ? expiry * 1000 : null;
  } catch {
    return null;
  }
}

function getBlobAuthentication(): BlobAuthentication {
  const readWriteToken = process.env.BLOB_READ_WRITE_TOKEN;
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  const diagnostics = getMediaUploadAuthenticationDiagnostics();
  const oidcExpiry = oidcToken ? getOidcExpiry(oidcToken) : null;
  const validOidc = Boolean(
    oidcToken && storeId && oidcExpiry && oidcExpiry > Date.now() + 60_000,
  );

  if (
    diagnostics.preferredAuthenticationKind === "VERCEL_OIDC_TOKEN" &&
    validOidc &&
    oidcToken &&
    storeId
  ) {
    return { oidcToken, storeId };
  }

  if (readWriteToken) {
    return { token: readWriteToken };
  }

  if (!oidcToken) {
    throw new MediaUploadConfigurationError(
      "BLOB_CREDENTIALS_MISSING",
      "Blob-Zugangsdaten fehlen. Lokal wird BLOB_READ_WRITE_TOKEN empfohlen; auf Vercel werden OIDC und BLOB_STORE_ID verwendet.",
    );
  }

  if (!storeId) {
    throw new MediaUploadConfigurationError(
      "BLOB_STORE_ID_MISSING",
      "BLOB_STORE_ID fehlt für die Vercel-OIDC-Authentifizierung.",
    );
  }

  if (!validOidc) {
    throw new MediaUploadConfigurationError(
      "BLOB_OIDC_EXPIRED",
      "Der lokale Vercel-OIDC-Token ist ungültig oder abgelaufen. Bitte die lokale Vercel-Umgebung aktualisieren oder BLOB_READ_WRITE_TOKEN setzen.",
    );
  }

  return { oidcToken, storeId };
}

export function getMediaUploadServerConfig(): MediaUploadServerConfig {
  validateApplicationConfiguration();

  const webhookPublicKey = process.env.BLOB_WEBHOOK_PUBLIC_KEY;

  if (!webhookPublicKey) {
    throw new MediaUploadConfigurationError(
      "BLOB_WEBHOOK_PUBLIC_KEY_MISSING",
      "BLOB_WEBHOOK_PUBLIC_KEY fehlt in der Server-Umgebung.",
    );
  }

  const environment = getMediaUploadEnvironment();

  return {
    environment,
    pathnamePrefix: `question-media/${environment}/`,
    blobAuthentication: getBlobAuthentication(),
    webhookPublicKey,
  };
}

export function logMediaUploadFailure(
  phase: string,
  error: unknown,
  internalCodeOrContext?:
    | string
    | Record<string, string | number | boolean | null>,
  additionalContext?: Record<string, string | number | boolean | null>,
) {
  const internalCode =
    typeof internalCodeOrContext === "string"
      ? internalCodeOrContext
      : undefined;
  const context =
    typeof internalCodeOrContext === "object"
      ? internalCodeOrContext
      : additionalContext;
  const details = getMediaUploadFailureDetails(phase, error, internalCode);

  console.error("Medien-Upload fehlgeschlagen", {
    phase,
    errorClass: details.errorClass,
    sanitizedMessage: details.sanitizedMessage,
    internalCode: details.code,
    authentication: getMediaUploadAuthenticationDiagnostics(),
    context,
  });
}

function sanitizeDiagnosticText(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, "[REDACTED_URL]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(?:Bearer|token|secret|cookie|authorization)\s*[=:]\s*\S+/gi, "[REDACTED_SECRET]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[REDACTED_VALUE]")
    .slice(0, 300);
}

function getFailureCode(phase: string) {
  const phaseCodes: Record<string, string> = {
    authentication: "AUTHENTICATION_FAILED",
    "user-authorization": "USER_AUTHORIZATION_FAILED",
    configuration: "MEDIA_UPLOAD_CONFIGURATION_FAILED",
    "request-processing": "UPLOAD_REQUEST_INVALID",
    "context-authorization": "UPLOAD_CONTEXT_NOT_AUTHORIZED",
    "signed-token": "BLOB_SIGNED_TOKEN_FAILED",
  };

  return phaseCodes[phase] ?? "MEDIA_UPLOAD_FAILED";
}

function getPublicFailureMessage(phase: string) {
  if (phase === "signed-token" || phase === "configuration") {
    return "Der Upload konnte serverseitig nicht autorisiert werden.";
  }

  if (phase === "context-authorization") {
    return "Der Upload ist für diesen Kontext nicht erlaubt.";
  }

  if (phase === "request-processing") {
    return "Die Upload-Anfrage ist ungültig.";
  }

  return "Der Upload konnte nicht verarbeitet werden.";
}

export function getMediaUploadFailureDetails(
  phase: string,
  error: unknown,
  internalCode?: string,
): MediaUploadFailureDetails {
  const isConfigurationError = error instanceof MediaUploadConfigurationError;
  const errorClass =
    error instanceof Error
      ? sanitizeDiagnosticText(error.constructor.name || error.name)
      : "UnknownError";
  const rawMessage =
    error instanceof Error ? error.message : "Unbekannter Fehlerwert.";

  return {
    code:
      internalCode ??
      (isConfigurationError ? error.code : getFailureCode(phase)),
    errorClass,
    sanitizedMessage: sanitizeDiagnosticText(rawMessage),
    publicMessage: isConfigurationError
      ? error.publicMessage
      : getPublicFailureMessage(phase),
  };
}
