import { BridgeError, check, STORE_ID, REPOSITORY_ID, OWNER_ID, type Mode } from "./contract";
import { verifyGithub, type Identity, type IdentityPins } from "./identity";
import { grantAccess, type BlobProvider } from "./service";

type Env = Readonly<Record<string, string | undefined>>;
export function configuration(env: Env): { mode: Mode; pins: IdentityPins } {
  check(env.VERCEL_ENV === "production" && !!env.AP94_OPERATIONS_PROJECT_ID && env.VERCEL_PROJECT_ID === env.AP94_OPERATIONS_PROJECT_ID &&
    (env.BLOB_STORE_ID === STORE_ID || env.BLOB_STORE_ID === STORE_ID.slice(6)) &&
    (env.AP94_BRIDGE_MODE === "synthetic" || env.AP94_BRIDGE_MODE === "acceptance"), "CONFIG_REJECTED");
  check(!Object.entries(env).some(([k, v]) => v && (/DATABASE_URL|BLOB_READ_WRITE_TOKEN|BLOB_API_URL/.test(k) || k === "PGPASSWORD")), "CONFIG_REJECTED");
  const pins = { repositoryId: env.AP94_GITHUB_REPOSITORY_ID ?? "", ownerId: env.AP94_GITHUB_OWNER_ID ?? "" };
  check(pins.repositoryId === REPOSITORY_ID && pins.ownerId === OWNER_ID, "CONFIG_REJECTED");
  return { mode: env.AP94_BRIDGE_MODE, pins };
}
const headers = { "content-type": "application/json", "cache-control": "no-store, private", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" };
export async function handleAccess(request: Request, env: Env, provider: BlobProvider,
  verify: (token: string, pins: IdentityPins) => Promise<Identity> = verifyGithub): Promise<Response> {
  try {
    check(request.method === "POST" && new URL(request.url).pathname === "/api/access" && !new URL(request.url).search);
    check(request.headers.get("content-type") === "application/json");
    const config = configuration(env);
    // Separate copy: never assume the trusted-sources header is forwarded to the function.
    const authorization = request.headers.get("authorization") ?? "";
    check(/^Bearer [A-Za-z0-9._-]+$/.test(authorization), "IDENTITY_REJECTED");
    const identity = await verify(authorization.slice(7), config.pins);
    check(request.body);
    const reader = request.body.getReader(); const parts: Uint8Array[] = []; let length = 0;
    try { for (;;) { const item = await reader.read(); if (item.done) break; length += item.value.length; check(length <= 2048); parts.push(item.value); } }
    finally { await reader.cancel().catch(() => undefined); }
    const body: unknown = JSON.parse(Buffer.concat(parts).toString("utf8"));
    return new Response(JSON.stringify(await grantAccess(body, identity, config.mode, provider)), { status: 200, headers });
  } catch (error) {
    const code = error instanceof BridgeError ? error.code : "REQUEST_REJECTED";
    return new Response(JSON.stringify({ error: code }), { status: code === "CONFIG_REJECTED" || code === "PROVIDER_REJECTED" ? 503 : 403, headers });
  }
}
