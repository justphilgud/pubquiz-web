import type { LogicalEnvironment } from "@/config/environment";

export type MediaUploadStoreEnvironment = "nonproduction" | "production";

export type PresentationTemplateUploadPolicyInput = {
  environment: LogicalEnvironment;
  explicitlyEnabled: boolean;
  readWriteToken: string | undefined;
  configuredStoreId: string | undefined;
  configuredStoreEnvironment: string | undefined;
};

export type PresentationTemplateUploadPolicyResult =
  | { enabled: true; storeId: string }
  | { enabled: false; reason: string };

export function readBlobStoreIdFromToken(token: string | undefined) {
  if (!token) return null;
  const [provider, product, access, storeId] = token.split("_");
  if (
    provider !== "vercel" ||
    product !== "blob" ||
    access !== "rw" ||
    !storeId
  ) {
    return null;
  }
  return storeId;
}

export function resolvePresentationTemplateUploadPolicy({
  environment,
  explicitlyEnabled,
  readWriteToken,
  configuredStoreId,
  configuredStoreEnvironment,
}: PresentationTemplateUploadPolicyInput): PresentationTemplateUploadPolicyResult {
  if (!explicitlyEnabled) {
    return {
      enabled: false,
      reason: "Template-Uploads sind für diese Umgebung nicht ausdrücklich freigegeben.",
    };
  }

  const tokenStoreId = readBlobStoreIdFromToken(readWriteToken);
  if (!tokenStoreId) {
    return {
      enabled: false,
      reason: "Das konfigurierte Blob-Credential enthält keine prüfbare Store-ID.",
    };
  }

  const expectedStoreId = configuredStoreId?.trim();
  if (!expectedStoreId || expectedStoreId !== tokenStoreId) {
    return {
      enabled: false,
      reason: "Blob-Credential und ausdrücklich bestätigte Store-ID stimmen nicht überein.",
    };
  }

  const expectedStoreEnvironment: MediaUploadStoreEnvironment =
    environment === "production" ? "production" : "nonproduction";
  if (configuredStoreEnvironment !== expectedStoreEnvironment) {
    return {
      enabled: false,
      reason:
        environment === "production"
          ? "Production benötigt einen ausdrücklich als Production klassifizierten Blob-Store."
          : "Development und Preview benötigen einen ausdrücklich als Non-Production klassifizierten Blob-Store.",
    };
  }

  return { enabled: true, storeId: tokenStoreId };
}
