import type { LogicalEnvironment } from "@/config/environment";

export function canWriteOpenTdbPilot(input: {
  environment: LogicalEnvironment;
  allowLocal: boolean;
}) {
  return canWriteExternalImportStaging(input);
}

export function canWriteExternalImportStaging(input: {
  environment: LogicalEnvironment;
  allowLocal: boolean;
}) {
  return input.environment === "preview" ||
    (input.environment === "development" && input.allowLocal);
}
