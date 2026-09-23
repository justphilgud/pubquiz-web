// Explicit workflow-only synthetic test. Never imports DB or backup/restore entrypoints.
import { setTimeout as delay } from "node:timers/promises";
import { BridgeClient } from "./bridge-client";
import { objectRule, runKey, STORE_ID } from "./bridge/lib/contract";
import { OperationsError, requireCondition, safeError } from "./guards";
import { createHash } from "node:crypto";
import { expectProbeDenial, tamperedProbeUrl } from "./transport-probe-diagnostics";
import { runIdentityProbe } from "./identity-probe";
import { GithubOidcTokenProvider } from "./oidc-token";
const sample = Buffer.from("AP9.4 OIDC bridge synthetic transport proof; no production data.\n");
const samples = [
  { name: "probe.bin", bytes: sample },
  { name: "probe.json", bytes: Buffer.from('{"synthetic":true,"productionData":false}\n') },
];
const diagnosticSamples = [
  { name: "diagnostic-1k.bin", size: 1024, fill: 0x11 },
  { name: "diagnostic-100k.bin", size: 100 * 1024, fill: 0x22 },
  { name: "diagnostic-1m.bin", size: 1024 * 1024, fill: 0x33 },
  { name: "diagnostic-5m.bin", size: 5 * 1024 * 1024, fill: 0x44 },
  { name: "diagnostic-typical.bin", size: 2 * 1024 * 1024, fill: 0x55 },
].map(item => ({ name: item.name, bytes: Buffer.alloc(item.size, item.fill) }));
const digest = (b: Buffer) => createHash("sha256").update(b).digest("hex");
let liveOidc: GithubOidcTokenProvider | undefined;
async function main() {
  const env = process.env;
  requireCondition(env.GITHUB_REPOSITORY === "justphilgud/pubquiz-web" && env.GITHUB_REF === "refs/heads/main" &&
    env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.AP94_TRANSPORT_MODE === "synthetic" &&
    (env.BACKUP_AUTOMATION_ENABLED === "true" || env.BACKUP_AUTOMATION_ENABLED === "false") &&
    (env.BACKUP_RETENTION_VERIFIED === "true" || env.BACKUP_RETENTION_VERIFIED === "false") &&
    !Object.keys(env).some(k => /DATABASE_URL|BLOB_READ_WRITE_TOKEN/.test(k) && env[k]), "SYNTHETIC_CONTEXT_REQUIRED");
  const role = process.argv[2]; requireCondition(role === "backup" || role === "restore", "PROBE_ROLE_REQUIRED");
  requireCondition(env.AP94_UPLOAD_DIAGNOSTIC_MATRIX === undefined || ["true", "false"].includes(env.AP94_UPLOAD_DIAGNOSTIC_MATRIX),
    "SYNTHETIC_CONTEXT_REQUIRED");
  const activeSamples = env.AP94_UPLOAD_DIAGNOSTIC_MATRIX === "true" ? [...samples, ...diagnosticSamples] : samples;
  const key = runKey("synthetic", env.GITHUB_RUN_ID ?? "", env.GITHUB_RUN_ATTEMPT ?? "");
  const oidc = new GithubOidcTokenProvider(env);
  liveOidc = oidc;
  const client = new BridgeClient(env, role, key, fetch, undefined, oidc);
  const body = { operation: role === "backup" ? "backup-readback" : "restore-read", store: STORE_ID, key, name: "probe.bin", kind: "probe" };
  const identityBoundary = await runIdentityProbe(env, body, fetch, oidc);
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
  for (const { name, bytes } of activeSamples) if (role === "backup") {
    const bounded = await client.grant(name, bytes.length);
    const headers = { "content-type": objectRule(name, "synthetic").contentType };
    const tooLarge = await fetch(bounded.url, { method: "PUT", body: new Uint8Array(bytes.length + 1), headers, redirect: "error", signal: AbortSignal.timeout(30000) });
    requireCondition(rejected(tooLarge.status), "SIGNED_SIZE_NOT_ENFORCED");
    await client.upload(name, bytes);
    const replay = await fetch(bounded.url, { method: "PUT", body: new Uint8Array(bytes), headers, redirect: "error", signal: AbortSignal.timeout(30000) });
    requireCondition(rejected(replay.status), "SIGNED_OVERWRITE_NOT_ENFORCED");
    await expectProbeDenial(await client.access({ ...body, name, operation: "backup-upload", bytes: bytes.length }), 10, "OBJECT_EXISTS");
  }
  const proofs = [];
  const grants = [];
  for (const { name, bytes } of activeSamples) {
    const restored = await client.read(name);
    requireCondition(restored.length === bytes.length && digest(restored) === digest(bytes), "SYNTHETIC_HASH_MISMATCH");
    proofs.push({ name, bytes: bytes.length, sha256: digest(bytes), readback: "verified" });
    grants.push(await client.grant(name));
  }
  for (const grant of grants) {
    for (const method of ["PUT", "DELETE"]) {
      const denied = await fetch(grant.url, { method, redirect: "error", signal: AbortSignal.timeout(30000) });
      requireCondition(rejected(denied.status), "SIGNED_OPERATION_NOT_ENFORCED");
    }
    const changed = tamperedProbeUrl(grant.url);
    const deniedPath = await fetch(changed, { redirect: "error", signal: AbortSignal.timeout(30000) });
    requireCondition(rejected(deniedPath.status), "SIGNED_PATH_NOT_ENFORCED");
  }
  // Never print the URL. Actual provider expiration is verified after its deadline.
  await delay(Math.max(0, ...grants.map(grant => grant.expiresAt - Date.now())) + 2000);
  for (const grant of grants) {
    const expired = await fetch(grant.url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000) });
    requireCondition(expired.status === 401 || expired.status === 403, "SIGNED_EXPIRY_NOT_ENFORCED");
  }
  return { synthetic: true, role, key, identityBoundary, hash: digest(sample), readback: "verified", expiry: "rejected", negatives: invalid.length,
    proofs, diagnosticMatrix: env.AP94_UPLOAD_DIAGNOSTIC_MATRIX === "true", signedMethodAndPath: "rejected",
    ...(role === "backup" ? { providerSizeAndOverwrite: "rejected" } : {}), deletion: false, oidc: client.oidcDiagnostics() };
}
main().then(r => console.log(JSON.stringify(r))).catch(e => {
  console.error(safeError(e instanceof OperationsError ? e : new OperationsError("SYNTHETIC_PROBE_FAILED_DETAILS_WITHHELD"))); process.exitCode = 1;
}).finally(() => { if (liveOidc) console.error(JSON.stringify({ event: "github-oidc-diagnostics", ...liveOidc.diagnostics() })); });
