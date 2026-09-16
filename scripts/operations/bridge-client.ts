import { parseStoreIdFromDelegationToken } from "@vercel/blob";
import { AUDIENCE, objectRule, runKey, STORE_HOST, STORE_ID, TTL_MS, type AccessRequest, type Grant, type Mode, type ObjectKind } from "./bridge/lib/contract";
import { OperationsError, requireCondition } from "./guards";
type Env = Readonly<Record<string, string | undefined>>;

// Only fixed categories escape. Never emit a provider message, path, URL or header.
export async function privateUploadFailure(response: Response, kind: ObjectKind): Promise<OperationsError> {
  const kinds = { database: "DATABASE", "auth-overlay": "AUTH_OVERLAY", manifest: "MANIFEST", media: "MEDIA", probe: "PROBE" };
  const artifact = Object.hasOwn(kinds, kind) ? kinds[kind] : "UNKNOWN";
  const allowed = new Set(["content_type_not_allowed", "client_token_pathname_mismatch", "client_token_expired", "file_too_large",
    "forbidden", "oidc_environment_not_allowed", "store_suspended", "store_not_found", "not_found", "client_token_not_allowed",
    "bad_request", "service_unavailable", "rate_limited", "precondition_failed", "not_allowed", "internal_server_error"]);
  let category = "UNKNOWN";
  try {
    const body: unknown = JSON.parse((await limitedResponse(response, 4096)).toString());
    const error = body && typeof body === "object" && "error" in body ? body.error : undefined;
    if (error && typeof error === "object") {
      if ("code" in error && typeof error.code === "string" && allowed.has(error.code)) category = error.code.toUpperCase();
      // Same bounded-message classification as @vercel/blob 2.4.0 getBlobError;
      // the message itself is neither returned nor used in an exception.
      const message = "message" in error && typeof error.message === "string" ? error.message : "";
      if (message.includes("contentType") && message.includes("is not allowed")) category = "CONTENT_TYPE_NOT_ALLOWED";
      else if (message.includes('"pathname"') && message.includes("does not match the token payload")) category = "CLIENT_TOKEN_PATHNAME_MISMATCH";
      else if (message === "Token expired") category = "CLIENT_TOKEN_EXPIRED";
      else if (message.includes("the file length cannot be greater than")) category = "FILE_TOO_LARGE";
    }
  } catch { /* Malformed, oversized or failed response streams remain fully redacted. */ }
  return new OperationsError(`PRIVATE_UPLOAD_${artifact}_HTTP_${response.status}_${category}`);
}

export async function requestGithubToken(env: Env, request: typeof fetch = fetch): Promise<string> {
  try {
    const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL ?? "");
    requireCondition(url.protocol === "https:" && url.hostname.endsWith(".actions.githubusercontent.com") && !url.port &&
      !url.username && !url.password && !url.hash && !!env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, "GITHUB_OIDC_UNAVAILABLE");
    url.searchParams.set("audience", AUDIENCE);
    const response = await request(url, { headers: { authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
      redirect: "error", signal: AbortSignal.timeout(15000) });
    requireCondition(response.ok, "GITHUB_OIDC_REJECTED");
    const data = JSON.parse((await limitedResponse(response, 20000)).toString()) as { value?: unknown };
    requireCondition(typeof data.value === "string" && data.value.length <= 16000 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.value), "GITHUB_OIDC_REJECTED");
    return data.value;
  } catch (error) { if (error instanceof OperationsError) throw error; throw new OperationsError("GITHUB_OIDC_FAILED_DETAILS_WITHHELD"); }
}

export async function limitedResponse(response: Response, limit: number): Promise<Buffer> {
  requireCondition(response.body, "BRIDGE_RESPONSE_EMPTY");
  const reader = response.body.getReader(); const parts: Uint8Array[] = []; let size = 0;
  try { for (;;) { const item = await reader.read(); if (item.done) break; size += item.value.length;
    requireCondition(size <= limit, "BRIDGE_RESPONSE_TOO_LARGE"); parts.push(item.value); } }
  finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(parts);
}
export function bridgeOrigin(value: string | undefined): string {
  const url = new URL(value ?? "");
  requireCondition(url.protocol === "https:" && /^pubquiz-backup-operations(?:-[a-z0-9-]+)?\.vercel\.app$/.test(url.hostname) &&
    !url.port && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash, "BRIDGE_ORIGIN_REJECTED");
  return url.origin;
}
export function validateGrant(grant: Grant, body: AccessRequest, now = Date.now()) {
  requireCondition(grant && grant.method === (body.operation === "backup-upload" ? "PUT" : "GET") &&
    Number.isFinite(grant.expiresAt) && grant.expiresAt > now && grant.expiresAt <= now + TTL_MS &&
    Number.isSafeInteger(grant.maximumSize) && grant.maximumSize > 0 && grant.maximumSize <= 128 * 1024 * 1024, "SIGNED_GRANT_REJECTED");
  const url = new URL(grant.url);
  requireCondition(url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
    parseStoreIdFromDelegationToken(url.searchParams.get("vercel-blob-delegation") ?? "") === STORE_ID.slice(6), "SIGNED_STORE_REJECTED");
  const path = `${body.key}/${body.name}`;
  requireCondition(grant.method === "PUT" ? url.origin === "https://vercel.com" && url.pathname === "/api/blob/" && url.searchParams.get("pathname") === path
    : url.hostname === STORE_HOST && url.pathname === `/${path}`, "SIGNED_PATH_REJECTED");
  if (grant.method === "PUT") requireCondition(grant.maximumSize === body.bytes, "SIGNED_SIZE_REJECTED");
  return grant;
}
export class BridgeClient {
  readonly origin: string;
  readonly key: string;
  readonly mode: Mode;
  constructor(private env: Env, private role: "backup" | "restore", key: string, private request: typeof fetch = fetch) {
    this.origin = bridgeOrigin(env.AP94_BRIDGE_ORIGIN);
    requireCondition(env.AP94_TRANSPORT_MODE === "synthetic" || env.AP94_TRANSPORT_MODE === "acceptance", "BRIDGE_MODE_REQUIRED");
    this.mode = env.AP94_TRANSPORT_MODE;
    this.key = runKey(this.mode, env.GITHUB_RUN_ID ?? "", env.GITHUB_RUN_ATTEMPT ?? "");
    requireCondition(key === this.key && env.BACKUP_PRIVATE_BLOB_HOST === STORE_HOST, "BRIDGE_KEY_OR_STORE_REJECTED");
    requireCondition(this.mode === "synthetic" || env.AP94_OIDC_TRANSPORT_ACCEPTED === "true", "OIDC_TRANSPORT_NOT_ACCEPTED");
  }
  private token() { return requestGithubToken(this.env, this.request); }
  async grant(name: string, uploadBytes?: number): Promise<Grant> {
    try {
      requireCondition(uploadBytes === undefined || this.role === "backup", "RESTORE_READ_ONLY");
      const rule = objectRule(name, this.mode);
      const body: AccessRequest = { operation: uploadBytes !== undefined ? "backup-upload" : this.role === "backup" ? "backup-readback" : "restore-read",
        store: STORE_ID, key: this.key, name, kind: rule.kind, ...(uploadBytes !== undefined ? { bytes: uploadBytes } : {}) };
      if (uploadBytes !== undefined) requireCondition(Number.isSafeInteger(uploadBytes) && uploadBytes > 0 && uploadBytes <= rule.maximumSize, "ARTIFACT_SIZE_LIMIT");
      const response = await this.access(body);
      requireCondition(response.ok, response.status === 403 ? "BRIDGE_ACCESS_REJECTED" : "BRIDGE_UNAVAILABLE");
      return validateGrant(JSON.parse((await limitedResponse(response, 20000)).toString()), body);
    } catch (error) { if (error instanceof OperationsError) throw error; throw new OperationsError("BRIDGE_REQUEST_FAILED_DETAILS_WITHHELD"); }
  }
  // Also used by the explicit synthetic acceptance harness for negative requests.
  async access(body: unknown) {
    try {
      const token = await this.token();
      return await this.request(`${this.origin}/api/access`, { method: "POST", headers: { "content-type": "application/json",
        authorization: `Bearer ${token}`, "x-vercel-trusted-oidc-idp-token": token }, body: JSON.stringify(body),
        redirect: "error", signal: AbortSignal.timeout(30000) });
    } catch { throw new OperationsError("BRIDGE_REQUEST_FAILED_DETAILS_WITHHELD"); }
  }
  async read(name: string) {
    try {
      const grant = await this.grant(name);
      const response = await this.request(grant.url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(120000) });
      requireCondition(response.status === 200, "PRIVATE_READBACK_FAILED");
      return await limitedResponse(response, grant.maximumSize);
    } catch (error) { if (error instanceof OperationsError) throw error; throw new OperationsError("SIGNED_READ_FAILED_DETAILS_WITHHELD"); }
  }
  async upload(name: string, bytes: Buffer) {
    try {
      const grant = await this.grant(name, bytes.length);
      const response = await this.request(grant.url, { method: "PUT", body: new Uint8Array(bytes), headers: { "content-type": objectRule(name, this.mode).contentType },
        redirect: "error", signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw await privateUploadFailure(response, objectRule(name, this.mode).kind);
      const result = JSON.parse((await limitedResponse(response, 20000)).toString()) as { url?: string };
      requireCondition(result.url === `https://${STORE_HOST}/${this.key}/${name}`, "PRIVATE_UPLOAD_IDENTITY_MISMATCH");
    } catch (error) { if (error instanceof OperationsError) throw error; throw new OperationsError("SIGNED_UPLOAD_FAILED_DETAILS_WITHHELD"); }
  }
}
