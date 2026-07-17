import "server-only";

import {
  assertBaseEnvironment,
  EnvironmentConfigurationError,
  getBlobEnvironmentPrefix,
  getBlobReadWriteToken,
  getLogicalEnvironment,
  type LogicalEnvironment,
} from "@/config/environment";
import {
  buildBlobPath,
  getBlobAreaPrefix,
  type BlobPathArea,
} from "@/app/lib/blobPath";

export type MediaUploadAuthenticationKind = "BLOB_READ_WRITE_TOKEN";

export type MediaUploadFailureDetails = {
  code: string;
  errorClass: string;
  sanitizedMessage: string;
  publicMessage: string;
};

export type MediaUploadServerConfig = {
  environment: LogicalEnvironment;
  environmentPrefix: "dev" | "preview" | "prod";
  blobAuthentication: { token: string };
  webhookPublicKey: string;
};

export type MediaVerificationServerConfig = Omit<
  MediaUploadServerConfig,
  "webhookPublicKey"
>;

export class MediaUploadConfigurationError extends Error {
  constructor(
    public readonly code: string,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "MediaUploadConfigurationError";
  }
}

export function getMediaUploadAuthenticationDiagnostics() {
  return {
    authenticationKind: "BLOB_READ_WRITE_TOKEN" as const,
    authenticationVariablePresent: Boolean(
      process.env.BLOB_READ_WRITE_TOKEN,
    ),
    preferredAuthenticationKind: "BLOB_READ_WRITE_TOKEN" as const,
    blobReadWriteTokenPresent: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    vercelOidcTokenPresent: Boolean(process.env.VERCEL_OIDC_TOKEN),
    vercelOidcTokenUsed: false,
    isVercelRuntime: Boolean(
      process.env.VERCEL_ENV || process.env.VERCEL === "1",
    ),
    vercelEnvironmentPresent: Boolean(process.env.VERCEL_ENV),
    mediaUploadEnvironmentPresent: Boolean(process.env.MEDIA_UPLOAD_ENV),
  };
}

export function getMediaUploadEnvironment() {
  return getLogicalEnvironment();
}

export function getMediaUploadEnvironmentPrefix() {
  return getBlobEnvironmentPrefix();
}

export function getMediaUploadPathnamePrefix(area: BlobPathArea) {
  return getBlobAreaPrefix(getMediaUploadEnvironmentPrefix(), area);
}

export function buildMediaUploadPathname(
  area: BlobPathArea,
  segments: readonly string[],
) {
  return buildBlobPath(getMediaUploadEnvironmentPrefix(), area, segments);
}

export function getBlobUploadAuthentication() {
  return { token: getBlobReadWriteToken() };
}

export function getMediaVerificationServerConfig(): MediaVerificationServerConfig {
  try {
    assertBaseEnvironment();
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      throw new MediaUploadConfigurationError(error.code, error.message);
    }

    throw error;
  }

  let token: string;

  try {
    token = getBlobReadWriteToken();
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      throw new MediaUploadConfigurationError(error.code, error.message);
    }

    throw error;
  }

  return {
    environment: getMediaUploadEnvironment(),
    environmentPrefix: getMediaUploadEnvironmentPrefix(),
    blobAuthentication: { token },
  };
}

export function getMediaUploadServerConfig(): MediaUploadServerConfig {
  const verificationConfig = getMediaVerificationServerConfig();
  const webhookPublicKey = process.env.BLOB_WEBHOOK_PUBLIC_KEY;

  if (!webhookPublicKey) {
    throw new MediaUploadConfigurationError(
      "BLOB_WEBHOOK_PUBLIC_KEY_MISSING",
      "BLOB_WEBHOOK_PUBLIC_KEY fehlt in der Server-Umgebung.",
    );
  }

  return { ...verificationConfig, webhookPublicKey };
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
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_TOKEN]",
    )
    .replace(
      /\b(?:Bearer|token|secret|cookie|authorization)\s*[=:]\s*\S+/gi,
      "[REDACTED_SECRET]",
    )
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
    "blob-verification": "BLOB_VERIFICATION_FAILED",
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
