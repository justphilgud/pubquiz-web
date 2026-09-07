import { backupProduction } from "./backup";
import { assertRestoreTarget, refreshPlan, OperationsError, safeError } from "./guards";

async function main() {
  switch (process.argv[2]) {
    case "backup":
      console.log(JSON.stringify(await backupProduction(process.env)));
      return;
    case "refresh":
      console.log(JSON.stringify(refreshPlan({ sourceEnvironment: "production", targetEnvironment: "preview", sourceUrl: process.env.PRODUCTION_BACKUP_DATABASE_URL, targetUrl: process.env.PREVIEW_DATABASE_URL })));
      // No destructive adapter until media credentials and access parity are verified.
      throw new OperationsError("BLOCKED_REFRESH_MEDIA_ISOLATION_AND_ACCESS_REVIEW_REQUIRED");
    case "restore-test":
      console.log(JSON.stringify(assertRestoreTarget(process.env.RESTORE_TEST_DATABASE_URL, "restore-test", process.env.RESTORE_TEST_EXPECTED_HOST ?? "")));
      throw new OperationsError("BLOCKED_RESTORE_PROVISIONING_AND_PRIVATE_BACKUP_REQUIRED");
    default: throw new OperationsError("OPERATION_REQUIRED");
  }
}
main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
