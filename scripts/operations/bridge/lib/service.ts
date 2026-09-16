import { BridgeError, check, objectRule, runKey, STORE_ID, TTL_MS, type Grant, type Mode } from "./contract";
import type { Identity } from "./identity";

export type Scope = { pathname: string; method: "PUT" | "GET"; maximumSize: number; expiresAt: number };
export interface BlobProvider {
  size(pathname: string): Promise<number | null>;
  sign(scope: Scope): Promise<string>;
}
export function authorize(body: unknown, identity: Identity, mode: Mode, now: number): Scope {
  check(body !== null && typeof body === "object" && !Array.isArray(body));
  const b = body as Record<string, unknown>;
  check(Object.keys(b).sort().join() === (b.operation === "backup-upload" ? "bytes,key,kind,name,operation,store" : "key,kind,name,operation,store"));
  const upload = b.operation === "backup-upload";
  check(identity.environment === "operations-backup" ? upload || b.operation === "backup-readback" : b.operation === "restore-read");
  check(b.store === STORE_ID && b.key === runKey(mode, identity.run, identity.attempt) && typeof b.name === "string");
  const rule = objectRule(b.name, mode);
  check(b.kind === rule.kind);
  if (upload) check(typeof b.bytes === "number" && Number.isSafeInteger(b.bytes) && b.bytes > 0 && b.bytes <= rule.maximumSize, "OBJECT_TOO_LARGE");
  const expiresAt = Math.min(now + TTL_MS, identity.expiresAt);
  check(expiresAt > now + 1000, "IDENTITY_REJECTED");
  return { pathname: `${b.key}/${b.name}`, method: upload ? "PUT" : "GET", maximumSize: upload ? b.bytes as number : rule.maximumSize, expiresAt };
}
export async function grantAccess(body: unknown, identity: Identity, mode: Mode, provider: BlobProvider, now = Date.now()): Promise<Grant> {
  const scope = authorize(body, identity, mode, now);
  try {
    const size = await provider.size(scope.pathname);
    if (scope.method === "PUT") check(size === null, "OBJECT_EXISTS");
    else { check(size !== null, "OBJECT_MISSING"); check(size > 0 && size <= scope.maximumSize, "OBJECT_TOO_LARGE"); }
    const url = await provider.sign(scope);
    return { url, method: scope.method, maximumSize: scope.maximumSize, expiresAt: scope.expiresAt };
  } catch (error) { if (error instanceof BridgeError) throw error; throw new BridgeError("PROVIDER_REJECTED"); }
}
