import "server-only";

import {
  getMediaUploadAuthenticationDiagnostics,
  getMediaUploadEnvironment,
  getMediaUploadEnvironmentPrefix,
} from "@/app/fragen/editor/mediaUploadEnvironment";

export function getPresentationTemplateUploadContext() {
  const environment = getMediaUploadEnvironment();
  const environmentPrefix = getMediaUploadEnvironmentPrefix();
  const diagnostics = getMediaUploadAuthenticationDiagnostics();
  const storeBindingConfirmed =
    process.env.TEMPLATE_MEDIA_UPLOAD_ENABLED === "true";
  const enabled =
    storeBindingConfirmed && diagnostics.blobReadWriteTokenPresent;

  return {
    environmentPrefix,
    enabled,
    disabledReason: enabled
      ? ""
      : environment === "development"
        ? "Development-Präfix und Credential sind vorhanden, die konkrete Non-Production-Store-Zuordnung ist aber noch nicht explizit bestätigt."
        : "Template-Uploads müssen für diese Umgebung separat und ausdrücklich freigegeben werden.",
  } as const;
}
