import "server-only";

import {
  getMediaUploadEnvironment,
  getMediaUploadEnvironmentPrefix,
  MediaUploadConfigurationError,
} from "@/app/fragen/editor/mediaUploadEnvironment";
import { resolvePresentationTemplateUploadPolicy } from "./presentationTemplateUploadPolicy";

export function getPresentationTemplateUploadContext() {
  const environment = getMediaUploadEnvironment();
  const environmentPrefix = getMediaUploadEnvironmentPrefix();
  const policy = resolvePresentationTemplateUploadPolicy({
    environment,
    explicitlyEnabled: process.env.TEMPLATE_MEDIA_UPLOAD_ENABLED === "true",
    readWriteToken: process.env.BLOB_READ_WRITE_TOKEN,
    configuredStoreId: process.env.BLOB_STORE_ID,
    configuredStoreEnvironment: process.env.MEDIA_UPLOAD_STORE_ENV,
  });

  return {
    environmentPrefix,
    enabled: policy.enabled,
    disabledReason: policy.enabled ? "" : policy.reason,
  } as const;
}

export function requirePresentationTemplateUploadContext() {
  const context = getPresentationTemplateUploadContext();
  if (!context.enabled) {
    throw new MediaUploadConfigurationError(
      "TEMPLATE_UPLOAD_STORE_NOT_CONFIRMED",
      context.disabledReason,
    );
  }
  return context;
}
