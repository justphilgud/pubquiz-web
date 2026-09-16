// Shared wire contract. This directory is the entire isolated Vercel project.
export const STORE_ID = "store_BVRjATGCRBW0fBeF";
export const STORE_HOST = "bvrjatgcrbw0fbef.private.blob.vercel-storage.com";
export const AUDIENCE = "urn:pubquiz:ap94:blob-bridge";
export const REPOSITORY = "justphilgud/pubquiz-web";
export const REPOSITORY_ID = "1253336192";
export const OWNER_ID = "288915542";
export const WORKFLOW = `${REPOSITORY}/.github/workflows/ap94-acceptance.yml@refs/heads/main`;
export const ISSUER = "https://token.actions.githubusercontent.com";
export const TTL_MS = 5 * 60 * 1000;
export type Mode = "synthetic" | "acceptance";
export type Operation = "backup-upload" | "backup-readback" | "restore-read";
export type ObjectKind = "database" | "auth-overlay" | "manifest" | "media" | "probe";
export type AccessRequest = { operation: Operation; store: string; key: string; name: string; kind: ObjectKind; bytes?: number };
export type Grant = { url: string; method: "PUT" | "GET"; expiresAt: number; maximumSize: number };
export class BridgeError extends Error {
  constructor(readonly code: "CONFIG_REJECTED" | "IDENTITY_REJECTED" | "REQUEST_REJECTED" | "OBJECT_EXISTS" | "OBJECT_MISSING" | "OBJECT_TOO_LARGE" | "PROVIDER_REJECTED") { super(code); }
}
export function check(condition: unknown, code: BridgeError["code"] = "REQUEST_REJECTED"): asserts condition {
  if (!condition) throw new BridgeError(code);
}
export function runKey(mode: Mode, run: string, attempt: string) {
  check(/^[1-9][0-9]{0,19}$/.test(run) && /^[1-9][0-9]{0,5}$/.test(attempt));
  return `${mode === "synthetic" ? "synthetic" : "production"}/acceptance/run-${run}-${attempt}`;
}
export function objectRule(name: string, mode: Mode): { kind: ObjectKind; maximumSize: number } {
  if (mode === "synthetic") { check(name === "probe.bin"); return { kind: "probe", maximumSize: 16 * 1024 }; }
  if (name === "database.dump") return { kind: "database", maximumSize: 128 * 1024 * 1024 };
  if (name === "auth-redacted.json") return { kind: "auth-overlay", maximumSize: 16 * 1024 * 1024 };
  if (name === "manifest.json") return { kind: "manifest", maximumSize: 16 * 1024 * 1024 };
  check(/^media-[a-f0-9]{64}\.bin$/.test(name));
  return { kind: "media", maximumSize: 128 * 1024 * 1024 };
}
