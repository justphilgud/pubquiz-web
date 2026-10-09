import { acceptanceBackup } from "./acceptance-backup";
import { acceptanceRestore } from "./acceptance-restore";
import { writeFileSync } from "node:fs";
import { backupFailureEvidence } from "./backup-diagnostics";
import { OperationsError, safeError } from "./guards";
async function main() {
  if (process.argv[2] === "backup") return acceptanceBackup(process.env);
  if (process.argv[2] === "restore") return acceptanceRestore(process.env);
  throw new OperationsError("ACCEPTANCE_OPERATION_REQUIRED");
}
main().then(result => console.log(JSON.stringify(result))).catch(error => {
  process.exitCode = 1;
  if (process.argv[2] !== "backup") { console.error(safeError(error)); return; }
  const evidence = backupFailureEvidence(error);
  console.error(JSON.stringify(evidence));
  if (process.env.BACKUP_FAILURE_EVIDENCE_PATH) {
    try { writeFileSync(process.env.BACKUP_FAILURE_EVIDENCE_PATH, JSON.stringify(evidence), { flag: "wx", mode: 0o600 }); }
    catch { console.error("BACKUP_DIAGNOSTIC_WRITE_FAILED"); }
  }
});
