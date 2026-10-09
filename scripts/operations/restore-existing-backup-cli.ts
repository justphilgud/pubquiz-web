import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existingBackupInput, verifiedExistingBackup } from "./restore-existing-backup";
import { requireCondition } from "./guards";

function main() {
  requireCondition(process.env.GITHUB_REPOSITORY === "justphilgud/pubquiz-web" && process.env.GITHUB_REF === "refs/heads/main" &&
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch", "EXISTING_BACKUP_CONTEXT_INVALID");
  const key = process.env.EXISTING_BACKUP_ID ?? "", hash = process.env.EXISTING_MANIFEST_SHA256 ?? "";
  const input = existingBackupInput(key, hash);
  const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 60000,
    stdio: ["ignore", "pipe", "pipe"] });
  const run = JSON.parse(gh(["api", `repos/justphilgud/pubquiz-web/actions/runs/${input.run}`]));
  const directory = mkdtempSync(join(tmpdir(), "restore-provenance-"));
  try {
    const inventory = JSON.parse(gh(["api", `repos/justphilgud/pubquiz-web/actions/runs/${input.run}/artifacts`]));
    const artifacts = inventory.artifacts.filter((a: {name:string;expired:boolean}) => a.name === "external-import-backup-evidence" && !a.expired);
    requireCondition(artifacts.length === 1, "EXISTING_BACKUP_EVIDENCE_UNAVAILABLE");
    gh(["run", "download", input.run, "--repo", "justphilgud/pubquiz-web", "--name", "external-import-backup-evidence", "--dir", directory]);
    const bytes = readFileSync(join(directory, "external-import-backup-evidence.json"));
    requireCondition(bytes.length <= 16384, "EXISTING_BACKUP_EVIDENCE_INVALID");
    const evidence = verifiedExistingBackup(key, hash, run, JSON.parse(bytes.toString("utf8")));
    appendFileSync(process.env.GITHUB_OUTPUT!, `key=${key}\nmanifest=${hash}\nproduction_sha=${evidence.productionSha}\n`);
    console.log("PASS – EXISTING_BACKUP_PROVENANCE_CONFIRMED");
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
try { main(); } catch { console.error("BLOCKED – EXISTING_BACKUP_NOT_VERIFIED"); process.exitCode = 1; }
