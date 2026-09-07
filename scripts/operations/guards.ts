export const DATABASES = {
  production: { host: "ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech", name: "neondb", schema: "pubquiz" },
  preview: { host: "ep-wispy-bird-al4hfg4e.c-3.eu-central-1.aws.neon.tech", name: "neondb", schema: "pubquiz" },
  development: { host: "ep-dry-dust-aljik09f.c-3.eu-central-1.aws.neon.tech", name: "neondb", schema: "pubquiz" },
} as const;

export class OperationsError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new OperationsError(code);
}

export function databaseIdentity(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    requireCondition(["postgres:", "postgresql:"].includes(url.protocol), "DATABASE_PROTOCOL");
    requireCondition(!url.port || url.port === "5432", "DATABASE_PORT");
    const host = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
    const name = decodeURIComponent(url.pathname.slice(1));
    const schema = url.searchParams.get("schema") ?? "pubquiz";
    requireCondition(host && name && !name.includes("/") && schema === "pubquiz", "DATABASE_IDENTITY");
    // Only identity metadata is returned. Never return credentials or query parameters.
    return { host, name, schema };
  } catch { throw new OperationsError("DATABASE_IDENTITY_INVALID"); }
}

export function assertDatabase(value: string | undefined, environment: keyof typeof DATABASES) {
  const actual = databaseIdentity(value);
  const expected = DATABASES[environment];
  requireCondition(actual.host === expected.host && actual.name === expected.name, "DATABASE_IDENTITY_MISMATCH");
  return actual;
}

export function refreshPlan(input: { sourceEnvironment: string; targetEnvironment: string; sourceUrl?: string; targetUrl?: string }) {
  requireCondition(input.sourceEnvironment === "production" && input.targetEnvironment === "preview", "REFRESH_DIRECTION_REJECTED");
  const source = assertDatabase(input.sourceUrl, "production");
  const target = assertDatabase(input.targetUrl, "preview");
  requireCondition(source.host !== target.host, "REFRESH_SAME_DATABASE");
  return { direction: "production -> preview", source, target };
}

export function assertRestoreTarget(value: string | undefined, environment: string, expectedTemporaryHost: string) {
  requireCondition(environment === "restore-test", "RESTORE_ENVIRONMENT_REJECTED");
  const actual = databaseIdentity(value);
  requireCondition(!Object.values(DATABASES).some(db => db.host === actual.host), "RESTORE_PERSISTENT_TARGET_REJECTED");
  requireCondition(/^ep-[a-z0-9-]+\.c-[0-9]+\.[a-z0-9-]+\.aws\.neon\.tech$/.test(expectedTemporaryHost), "RESTORE_HOST_UNVERIFIED");
  requireCondition(actual.host === expectedTemporaryHost && actual.name === "neondb", "RESTORE_HOST_MISMATCH");
  return actual;
}

export type BackupKind = "daily" | "weekly" | "release";
export function backupPolicy(kind: string): { kind: BackupKind; retentionDays: number } {
  requireCondition(["daily", "weekly", "release"].includes(kind), "BACKUP_KIND_INVALID");
  return { kind: kind as BackupKind, retentionDays: kind === "daily" ? 14 : kind === "weekly" ? 56 : 186 };
}

export function assertDumpIntegrity(exitCode: number | null, bytes: number, listExitCode: number | null) {
  requireCondition(exitCode === 0 && bytes > 0 && listExitCode === 0, "BACKUP_INTEGRITY_FAILED");
}

export function safeError(error: unknown) {
  return error instanceof OperationsError ? error.code : "OPERATIONS_FAILED_DETAILS_WITHHELD";
}
