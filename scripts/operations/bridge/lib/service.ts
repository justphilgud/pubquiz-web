import { BridgeError, check, INVENTORY_PAGE_LIMIT, inventoryCursor, objectRule, runKey, storedBackupKey, STORE_ID, TTL_MS, type ContentType, type DeleteResult, type Grant, type InventoryResult, type Mode } from "./contract.js";
import type { Identity } from "./identity.js";

export type Scope = { pathname: string; method: "PUT" | "GET"; maximumSize: number; expiresAt: number; contentType: ContentType };
export interface BlobProvider {
  size(pathname: string): Promise<number | null>;
  sign(scope: Scope): Promise<string>;
  inventory(prefix: string, cursor?: string): Promise<InventoryResult>;
  remove(pathname: string, etag: string): Promise<void>;
}
export function authorize(body: unknown, identity: Identity, mode: Mode, now: number): Scope {
  check(body !== null && typeof body === "object" && !Array.isArray(body));
  const b = body as Record<string, unknown>;
  check(Object.keys(b).sort().join() === (b.operation === "backup-upload" ? "bytes,key,kind,name,operation,store" : "key,kind,name,operation,store"));
  const upload = b.operation === "backup-upload";
  const retentionRead = b.operation === "backup-retention-read";
  check(identity.environment === "operations-backup" ? upload || b.operation === "backup-readback" || retentionRead : b.operation === "restore-read");
  check(identity.environment !== "operations-restore" || identity.eventName === "workflow_dispatch");
  const expectedKey = retentionRead ? storedBackupKey(String(b.key)) : runKey(mode, identity.run, identity.attempt);
  check(b.store === STORE_ID && b.key === expectedKey && typeof b.name === "string");
  const rule = objectRule(b.name, mode);
  if (retentionRead) check(mode === "acceptance" && b.name === "manifest.json" && b.kind === "manifest");
  check(b.kind === rule.kind);
  if (upload) check(typeof b.bytes === "number" && Number.isSafeInteger(b.bytes) && b.bytes > 0 && b.bytes <= rule.maximumSize, "OBJECT_TOO_LARGE");
  const expiresAt = Math.min(now + TTL_MS, identity.expiresAt);
  check(expiresAt > now + 1000, "IDENTITY_REJECTED");
  return { pathname: `${b.key}/${b.name}`, method: upload ? "PUT" : "GET", maximumSize: upload ? b.bytes as number : rule.maximumSize, expiresAt, contentType: rule.contentType };
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

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function executeAccess(body: unknown, identity: Identity, mode: Mode, provider: BlobProvider, now = Date.now()): Promise<Grant | InventoryResult | DeleteResult> {
  if (record(body) && body.operation === "backup-inventory") {
    check(identity.environment === "operations-backup" && mode === "acceptance");
    const fields = Object.keys(body).sort().join();
    check((fields === "operation,store" || fields === "cursor,operation,store") && body.store === STORE_ID);
    const cursor = body.cursor;
    check(cursor === undefined || inventoryCursor(cursor));
    try {
      const result = await provider.inventory("production/acceptance/", cursor);
      check(result.objects.length <= INVENTORY_PAGE_LIMIT && result.complete === (result.cursor === null));
      check(result.cursor === null || inventoryCursor(result.cursor));
      for (const object of result.objects) {
        check(object.pathname.startsWith("production/acceptance/") && object.pathname.length <= 240 &&
          Number.isSafeInteger(object.size) && object.size > 0 && Number.isFinite(Date.parse(object.uploadedAt)) &&
          /^[\x21-\x7e]{1,200}$/.test(object.etag));
      }
      return result;
    } catch (error) { if (error instanceof BridgeError) throw error; throw new BridgeError("PROVIDER_REJECTED"); }
  }
  if (record(body) && body.operation === "retention-delete") {
    check(identity.environment === "operations-backup" && mode === "acceptance");
    check(Object.keys(body).sort().join() === "etag,key,name,operation,store" && body.store === STORE_ID &&
      typeof body.key === "string" && typeof body.name === "string" && typeof body.etag === "string");
    const key = storedBackupKey(body.key);
    check(key !== runKey(mode, identity.run, identity.attempt));
    const name = body.name; objectRule(name, mode);
    check(/^[a-z0-9][a-z0-9.-]{0,100}$/.test(name) && !name.includes("..") && /^[\x21-\x7e]{1,200}$/.test(body.etag));
    try { await provider.remove(`${key}/${name}`, body.etag); return { deleted: true }; }
    catch (error) { if (error instanceof BridgeError) throw error; throw new BridgeError("PROVIDER_REJECTED"); }
  }
  return grantAccess(body, identity, mode, provider, now);
}
