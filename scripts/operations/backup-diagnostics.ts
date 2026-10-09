import { OperationsError } from "./guards";

export const backupFailureCodes = {
  PREPARATION: "BACKUP_PREPARATION_FAILED", TRANSPORT_PREFLIGHT: "BACKUP_TRANSPORT_PREFLIGHT_FAILED",
  SOURCE_SESSION: "DB_SESSION_FAILED", SOURCE_CAPTURE: "DB_SNAPSHOT_FAILED",
  DB_EXPORT: "DB_EXPORT_FAILED", DUMP_INTEGRITY: "INTEGRITY_CHECK_FAILED",
  SOURCE_COMMIT: "DB_SESSION_CLOSE_FAILED", MEDIA_CAPTURE: "MEDIA_BACKUP_FAILED",
  AUTH_OVERLAY_FILE: "AUTH_OVERLAY_FAILED", DATA_UPLOAD: "BACKUP_UPLOAD_FAILED",
  MANIFEST_UPLOAD: "MANIFEST_FAILED", PRIVATE_READBACK: "PRIVATE_READBACK_FAILED",
  ARTIFACT_INTEGRITY: "ARTIFACT_INTEGRITY_CHECK_FAILED",
  ANONYMOUS_READBACK: "PRIVATE_ACCESS_CHECK_FAILED", CLEANUP: "BACKUP_CLEANUP_FAILED",
} as const;
export type BackupPhase = keyof typeof backupFailureCodes;
export class BackupDiagnosticError extends OperationsError {
  constructor(readonly phase: BackupPhase) { super(backupFailureCodes[phase]); }
}
export function backupPhaseError(error: unknown, phase: BackupPhase): BackupDiagnosticError {
  if (!Object.hasOwn(backupFailureCodes, phase)) throw new OperationsError("BACKUP_DIAGNOSTIC_PHASE_INVALID");
  // Preserve the precise nested readback/integrity phase; never retain raw errors/causes.
  return error instanceof BackupDiagnosticError ? error : new BackupDiagnosticError(phase);
}
export async function backupPhase<T>(phase: BackupPhase, operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) { throw backupPhaseError(error, phase); }
}
export function backupFailureEvidence(error: unknown) {
  const classified = backupPhaseError(error, "PREPARATION");
  return { version: 1, status: "FAIL", phase: classified.phase, code: classified.code } as const;
}
