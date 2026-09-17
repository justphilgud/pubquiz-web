import { requireCondition } from "./guards";

export const BACKUP_TYPES = ["scheduled", "manual", "pre-deployment", "pre-event"] as const;
export type BackupType = (typeof BACKUP_TYPES)[number];

export type BackupMetadata = {
  type: BackupType;
  protected: boolean;
  trigger: "schedule" | "workflow_dispatch";
};

type Environment = Readonly<Record<string, string | undefined>>;

export function isBackupType(value: unknown): value is BackupType {
  return typeof value === "string" && BACKUP_TYPES.includes(value as BackupType);
}
export function validateBackupMetadata(value: unknown): BackupMetadata {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), "BACKUP_METADATA_INVALID");
  const metadata = value as Record<string, unknown>;
  requireCondition(
    Object.keys(metadata).sort().join() === "protected,trigger,type" &&
      isBackupType(metadata.type) &&
      typeof metadata.protected === "boolean" &&
      (metadata.trigger === "schedule" || metadata.trigger === "workflow_dispatch"),
    "BACKUP_METADATA_INVALID",
  );
  requireCondition(
    metadata.type === "scheduled"
      ? metadata.trigger === "schedule" && metadata.protected === false
      : metadata.trigger === "workflow_dispatch",
    "BACKUP_METADATA_INVALID",
  );
  requireCondition(
    !["pre-deployment", "pre-event"].includes(metadata.type) || metadata.protected === true,
    "BACKUP_METADATA_INVALID",
  );
  return metadata as BackupMetadata;
}

export function backupMetadataFromEnvironment(env: Environment): BackupMetadata {
  requireCondition(
    env.GITHUB_REPOSITORY === "justphilgud/pubquiz-web" && env.GITHUB_REF === "refs/heads/main",
    "BACKUP_REPOSITORY_OR_REF_REJECTED",
  );
  requireCondition(
    env.BACKUP_AUTOMATION_ENABLED === "true" || env.BACKUP_AUTOMATION_ENABLED === "false",
    "BACKUP_AUTOMATION_SWITCH_INVALID",
  );
  requireCondition(
    env.BACKUP_RETENTION_VERIFIED === "true" || env.BACKUP_RETENTION_VERIFIED === "false",
    "BACKUP_RETENTION_SWITCH_INVALID",
  );

  if (env.GITHUB_EVENT_NAME === "schedule") {
    requireCondition(env.BACKUP_AUTOMATION_ENABLED === "true", "BACKUP_AUTOMATION_DISABLED");
    return { type: "scheduled", protected: false, trigger: "schedule" };
  }

  requireCondition(
    env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.AP94_MANUAL_ACCEPTANCE === "true",
    "MANUAL_ACCEPTANCE_REQUIRED",
  );
  requireCondition(isBackupType(env.AP96_BACKUP_TYPE) && env.AP96_BACKUP_TYPE !== "scheduled", "BACKUP_TYPE_INVALID");
  requireCondition(env.AP96_BACKUP_PROTECTED === "true" || env.AP96_BACKUP_PROTECTED === "false", "BACKUP_PROTECTION_INVALID");
  return validateBackupMetadata({
    type: env.AP96_BACKUP_TYPE,
    protected: env.AP96_BACKUP_TYPE === "pre-deployment" || env.AP96_BACKUP_TYPE === "pre-event" || env.AP96_BACKUP_PROTECTED === "true",
    trigger: "workflow_dispatch",
  });
}
