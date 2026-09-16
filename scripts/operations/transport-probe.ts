// Explicit workflow-only synthetic test. Never imports DB or backup/restore entrypoints.
import { setTimeout as delay } from "node:timers/promises";
import { BridgeClient } from "./bridge-client";
import { runKey, STORE_ID } from "./bridge/lib/contract";
import { OperationsError, requireCondition, safeError } from "./guards";
import { createHash } from "node:crypto";
import { expectProbeDenial } from "./transport-probe-diagnostics";
import { runIdentityProbe } from "./identity-probe";
const sample = Buffer.from("AP9.4 OIDC bridge synthetic transport proof; no production data.\n");
const digest = (b: Buffer) => createHash("sha256").update(b).digest("hex");
async function main() {
  const env = process.env;
  requireCondition(env.GITHUB_REPOSITORY === "justphilgud/pubquiz-web" && env.GITHUB_REF === "refs/heads/main" &&
    env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.AP94_TRANSPORT_MODE === "synthetic" &&
    env.BACKUP_AUTOMATION_ENABLED === "false" && env.BACKUP_RETENTION_VERIFIED === "false" &&
    !Object.keys(env).some(k => /DATABASE_URL|BLOB_READ_WRITE_TOKEN/.test(k) && env[k]), "SYNTHETIC_CONTEXT_REQUIRED");
  const role = process.argv[2]; requireCondition(role === "backup" || role === "restore", "PROBE_ROLE_REQUIRED");
  const key = runKey("synthetic", env.GITHUB_RUN_ID ?? "", env.GITHUB_RUN_ATTEMPT ?? "");
  const client = new BridgeClient(env, role, key);
  const body = { operation: role === "backup" ? "backup-readback" : "restore-read", store: STORE_ID, key, name: "probe.bin", kind: "probe" };
  const identityBoundary = await runIdentityProbe(env, body);
  const invalid = [
    { ...body, store: "store_other" }, { ...body, key: `${key}-other` }, { ...body, name: "../probe.bin" },
    { ...body, name: "manifest.json", kind: "manifest" }, { ...body, operation: "delete" }, { ...body, allowOverwrite: true },
    role === "backup" ? { ...body, operation: "restore-read" } : { ...body, operation: "backup-upload", bytes: sample.length },
    ...(role === "restore" ? [{ ...body, operation: "backup-readback" }] : []),
    { ...body, operation: "backup-upload", bytes: 16385 },
  ];
  for (const [index, value] of invalid.entries()) {
    await expectProbeDenial(await client.access(value), index + 1,
      role === "backup" && index === invalid.length - 1 ? "OBJECT_TOO_LARGE" : "REQUEST_REJECTED");
  }
  const rejected = (status: number) => [400, 401, 403, 404, 405, 409, 412, 413].includes(status);
  if (role === "backup") {
    const bounded = await client.grant("probe.bin", sample.length);
    const tooLarge = await fetch(bounded.url, { method: "PUT", body: new Uint8Array(sample.length + 1), headers: { "content-type": "application/octet-stream" }, redirect: "error", signal: AbortSignal.timeout(30000) });
    requireCondition(rejected(tooLarge.status), "SIGNED_SIZE_NOT_ENFORCED");
    await client.upload("probe.bin", sample);
    const replay = await fetch(bounded.url, { method: "PUT", body: new Uint8Array(sample), headers: { "content-type": "application/octet-stream" }, redirect: "error", signal: AbortSignal.timeout(30000) });
    requireCondition(rejected(replay.status), "SIGNED_OVERWRITE_NOT_ENFORCED");
    await expectProbeDenial(await client.access({ ...body, operation: "backup-upload", bytes: sample.length }), 10, "OBJECT_EXISTS");
  }
  requireCondition(digest(await client.read("probe.bin")) === digest(sample), "SYNTHETIC_HASH_MISMATCH");
  const grant = await client.grant("probe.bin");
  for (const method of ["PUT", "DELETE"]) {
    const denied = await fetch(grant.url, { method, redirect: "error", signal: AbortSignal.timeout(30000) });
    requireCondition(rejected(denied.status), "SIGNED_OPERATION_NOT_ENFORCED");
  }
  const changed = new URL(grant.url); changed.pathname = changed.pathname.replace("probe.bin", "other.bin");
  const deniedPath = await fetch(changed, { redirect: "error", signal: AbortSignal.timeout(30000) });
  requireCondition(rejected(deniedPath.status), "SIGNED_PATH_NOT_ENFORCED");
  // Never print the URL. Actual provider expiration is verified after its deadline.
  await delay(Math.max(0, grant.expiresAt - Date.now()) + 2000);
  const expired = await fetch(grant.url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000) });
  requireCondition(expired.status === 401 || expired.status === 403, "SIGNED_EXPIRY_NOT_ENFORCED");
  return { synthetic: true, role, key, identityBoundary, hash: digest(sample), readback: "verified", expiry: "rejected", negatives: invalid.length,
    signedMethodAndPath: "rejected", ...(role === "backup" ? { providerSizeAndOverwrite: "rejected" } : {}), deletion: false };
}
main().then(r => console.log(JSON.stringify(r))).catch(e => {
  console.error(safeError(e instanceof OperationsError ? e : new OperationsError("SYNTHETIC_PROBE_FAILED_DETAILS_WITHHELD"))); process.exitCode = 1;
});
