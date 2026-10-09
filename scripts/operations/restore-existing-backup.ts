import { requireCondition } from "./guards";
import { backupKey } from "./private-artifacts";
import { parseExternalImportBackupEvidence } from "../external-import/backup-evidence";
export function existingBackupInput(key: string, hash: string) {
  backupKey(key);
  const match = /^production\/acceptance\/run-([1-9][0-9]{0,19})-([1-9][0-9]{0,5})$/.exec(key);
  requireCondition(match && /^[a-f0-9]{64}$/.test(hash), "EXISTING_BACKUP_INPUT_INVALID");
  return { run: match[1], attempt: match[2], backupId: key, manifestSha256: hash };
}
export function verifiedExistingBackup(key: string, hash: string, run: Record<string, unknown>, evidence: unknown) {
  const expected = existingBackupInput(key, hash);
  const repository = run.repository as { full_name?: string } | undefined;
  requireCondition(String(run.id) === expected.run && String(run.run_attempt) === expected.attempt &&
    run.path === ".github/workflows/ap94-acceptance.yml" && run.head_branch === "main" &&
    repository?.full_name === "justphilgud/pubquiz-web" && run.status === "completed" && run.conclusion === "success" &&
    ["schedule", "workflow_dispatch"].includes(String(run.event)), "EXISTING_BACKUP_RUN_UNVERIFIED");
  const source = evidence as { productionSha?: string } | null;
  requireCondition(source && /^[a-f0-9]{40}$/.test(source.productionSha ?? ""), "EXISTING_BACKUP_EVIDENCE_INVALID");
  return parseExternalImportBackupEvidence(evidence, { ...expected, productionSha: source.productionSha! });
}
