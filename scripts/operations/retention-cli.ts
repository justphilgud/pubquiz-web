import { retentionAfterBackup, safeRetentionError } from "./retention";
import { requireCondition } from "./guards";

async function main() {
  const key = process.env.AP96_CURRENT_BACKUP_KEY ?? "";
  const manifest = process.env.AP96_CURRENT_MANIFEST_SHA256 ?? "";
  requireCondition(key.length > 0 && manifest.length > 0, "RETENTION_CURRENT_BACKUP_REQUIRED");
  return retentionAfterBackup(process.env, key, manifest);
}

main().then(result => console.log(JSON.stringify(result))).catch(error => {
  console.error(safeRetentionError(error)); process.exitCode = 1;
});
