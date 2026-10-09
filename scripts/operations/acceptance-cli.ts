import { acceptanceBackup } from "./acceptance-backup";
import { acceptanceRestore } from "./acceptance-restore";
import { writeFileSync } from "node:fs";
import { backupFailureEvidence } from "./backup-diagnostics";
import { OperationsError } from "./guards";
async function main() {
  if (process.argv[2] === "backup") return acceptanceBackup(process.env);
  if (process.argv[2] === "restore") return acceptanceRestore(process.env);
  throw new OperationsError("ACCEPTANCE_OPERATION_REQUIRED");
}
main().then(result => {
  if (process.argv[2] === "restore" && process.env.RESTORE_EVIDENCE_PATH) {
    if ("preflightOnly" in result && result.preflightOnly === true) {
      const evidence = {version:1,status:"PASS",backupId:result.key,manifestSha256:result.manifestSha256,
        target:result.target,targetIdentityPermissionsEmpty:"PASS",mediaIntegrity:"PASS",restoreExecuted:false};
      writeFileSync(process.env.RESTORE_EVIDENCE_PATH,JSON.stringify(evidence),{flag:"wx",mode:0o600});
      console.log("PASS - ISOLATED_RESTORE_PREFLIGHT_ONLY"); return;
    }
    const restore=result as {key:string;snapshotAt:string;backupCompletedAt:string;backupVersion:number;sourceProductionSha:string;restoredOriginals:number;target:unknown};
    const evidence = { version: 1, status: "PASS", backupId: restore.key,
      backupSnapshotAt:restore.snapshotAt,backupCompletedAt:restore.backupCompletedAt,
      backupVersion:restore.backupVersion,sourceProductionSha:restore.sourceProductionSha,mediaCount:restore.restoredOriginals,
      manifestSha256: process.env.AP94_MANIFEST_SHA256, target: restore.target, completedAt: new Date().toISOString(),
      databaseIntegrity: "PASS", mediaIntegrity: "PASS", restoreExecuted: true };
    writeFileSync(process.env.RESTORE_EVIDENCE_PATH, JSON.stringify(evidence), {flag:"wx",mode:0o600});
    console.log("PASS – ISOLATED_RESTORE_VERIFIED");
  } else console.log(JSON.stringify(result));
}).catch(error => {
  process.exitCode = 1;
  if (process.argv[2] !== "backup") {
    const allowed = new Set(["RESTORE_TARGET_IDENTITY_BLOCKED","RESTORE_TARGET_NOT_EMPTY","RESTORE_TARGET_PRIVILEGES_BLOCKED",
      "RESTORE_ISOLATION_LABEL_REQUIRED","TEMPORARY_RESTORE_TARGET_REQUIRED","TEMPORARY_RESTORE_METADATA_INVALID","TEMPORARY_RESTORE_DATABASE_INVALID",
      "TEMPORARY_RESTORE_PROJECT_INVALID","TEMPORARY_RESTORE_LEASE_INVALID","TEMPORARY_RESTORE_BACKUP_MISMATCH",
      "TEMPORARY_RESTORE_MARKER_INVALID","TEMPORARY_RESTORE_CONNECTION_INVALID","TEMPORARY_RESTORE_ACCESS_NOT_ISOLATED","MANIFEST_CHECKSUM_MISMATCH","MANIFEST_IDENTITY_MISMATCH","MANIFEST_INCOMPLETE",
      "MANIFEST_SOURCE_MISMATCH","MANIFEST_TIMES_INVALID","ARTIFACT_CHECKSUM_MISMATCH","PINNED_RESTORE_TARGET_REQUIRED"]);
    const code=error instanceof OperationsError && allowed.has(error.code)?error.code:"RESTORE_NOT_VERIFIED";
    const evidence = {version:1,status:"BLOCKED",code};
    console.error(`BLOCKED – ${code}`);
    if(process.env.RESTORE_FAILURE_PATH)try {writeFileSync(process.env.RESTORE_FAILURE_PATH,JSON.stringify(evidence),{flag:"wx",mode:0o600});}catch {console.error("RESTORE_DIAGNOSTIC_WRITE_FAILED");}
    return;
  }
  const evidence = backupFailureEvidence(error);
  console.error(JSON.stringify(evidence));
  if (process.env.BACKUP_FAILURE_EVIDENCE_PATH) {
    try { writeFileSync(process.env.BACKUP_FAILURE_EVIDENCE_PATH, JSON.stringify(evidence), { flag: "wx", mode: 0o600 }); }
    catch { console.error("BACKUP_DIAGNOSTIC_WRITE_FAILED"); }
  }
});
