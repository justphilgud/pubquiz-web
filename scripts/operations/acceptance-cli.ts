import { acceptanceBackup } from "./acceptance-backup";
import { acceptanceRestore } from "./acceptance-restore";
import { OperationsError, safeError } from "./guards";
async function main() {
  if (process.argv[2] === "backup") return acceptanceBackup(process.env);
  if (process.argv[2] === "restore") return acceptanceRestore(process.env);
  throw new OperationsError("ACCEPTANCE_OPERATION_REQUIRED");
}
main().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(safeError(error)); process.exitCode = 1; });
