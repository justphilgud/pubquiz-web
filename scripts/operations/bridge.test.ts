import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { AUDIENCE, ISSUER, REPOSITORY, STORE_ID, STORE_HOST, WORKFLOW, runKey, TTL_MS, type Grant } from "./bridge/lib/contract";
import { verifyGithub, type Identity } from "./bridge/lib/identity";
import { grantAccess, type BlobProvider, type Scope } from "./bridge/lib/service";
import { handleAccess, configuration } from "./bridge/lib/handler";
import { createBlobProvider } from "./bridge/lib/provider";
import { BridgeClient, validateGrant } from "./bridge-client";
import { readFileSync } from "node:fs";
import { presignUrl } from "@vercel/blob";
import { expectProbeDenial } from "./transport-probe-diagnostics";

test("live probe cannot count an edge or identity rejection as operation authorization proof", async () => {
  await expectProbeDenial(Response.json({ error: "REQUEST_REJECTED" }, { status: 403 }), 1);
  await expectProbeDenial(Response.json({ error: "OBJECT_TOO_LARGE" }, { status: 403 }), 8, "OBJECT_TOO_LARGE");
  await expectProbeDenial(Response.json({ error: "OBJECT_EXISTS" }, { status: 403 }), 10, "OBJECT_EXISTS");
  for (const [status, code] of [[401, "REQUEST_REJECTED"], [403, "IDENTITY_REJECTED"],
    [503, "CONFIG_REJECTED"], [503, "PROVIDER_REJECTED"], [403, "OBJECT_MISSING"], [200, "REQUEST_REJECTED"]] as const) {
    await assert.rejects(expectProbeDenial(Response.json({ error: code }, { status }), 1),
      new RegExp(`^Error: SYNTHETIC_CASE_1_HTTP_${status}_BODY_${code}$`));
  }
});

test("live probe diagnostics redact arbitrary provider bodies, headers, URLs and stream errors", async () => {
  const secret = "synthetic-secret-canary";
  const responses = [new Response(secret, { status: 401, headers: { location: `https://example.com/?token=${secret}` } }),
    Response.json({ error: secret }, { status: 403 }),
    Response.json({ error: "REQUEST_REJECTED", token: secret }, { status: 403 }),
    new Response(secret.repeat(200), { status: 503 }),
    new Response(new ReadableStream({ start(controller) { controller.error(new Error(secret)); } }), { status: 502 })];
  for (const response of responses) {
    await assert.rejects(expectProbeDenial(response, 2),
      new RegExp(`^Error: SYNTHETIC_CASE_2_HTTP_${response.status}_BODY_UNRECOGNIZED$`));
  }
  await assert.rejects(expectProbeDenial(new Response(), Number.NaN), /SYNTHETIC_CASE_INVALID/);
});

const now = Date.now(); const seconds = Math.floor(now / 1000);
const pins = { repositoryId: "1253336192", ownerId: "288915542" };
const identity: Identity = { environment: "operations-backup", run: "123456", attempt: "1", expiresAt: now + TTL_MS };
const key = runKey("synthetic", identity.run, identity.attempt);
const upload = { operation: "backup-upload", store: STORE_ID, key, name: "probe.bin", kind: "probe", bytes: 12 };
const readback = { operation: "backup-readback", store: STORE_ID, key, name: "probe.bin", kind: "probe" };
const env = { VERCEL_ENV: "production", VERCEL_PROJECT_ID: "prj_operations", AP94_OPERATIONS_PROJECT_ID: "prj_operations",
  BLOB_STORE_ID: STORE_ID, AP94_BRIDGE_MODE: "synthetic", AP94_GITHUB_REPOSITORY_ID: pins.repositoryId, AP94_GITHUB_OWNER_ID: pins.ownerId };
const claims = { repository: REPOSITORY, repository_owner: "justphilgud", repository_id: pins.repositoryId, repository_owner_id: pins.ownerId,
  ref: "refs/heads/main", workflow_ref: WORKFLOW, event_name: "workflow_dispatch", environment: "operations-backup",
  sub: `repo:${REPOSITORY}:environment:operations-backup`, run_id: identity.run, run_attempt: identity.attempt, sha: "a".repeat(40),
  iss: ISSUER, aud: AUDIENCE, iat: seconds, nbf: seconds, exp: seconds + 300 };

test("Variant 2 adversarial HTTP boundary: verified JWT is the only authority", async t => {
  const keys = await generateKeyPair("RS256");
  const jwks = createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: "adversarial" }] });
  const sign = (delta: Record<string, unknown>) => new SignJWT({ ...claims, ...delta }).setProtectedHeader({ alg: "RS256", kid: "adversarial" }).sign(keys.privateKey);
  const restore = { environment: "operations-restore", sub: `repo:${REPOSITORY}:environment:operations-restore` };
  const cases: [string, Record<string, unknown>, object][] = [
    ["01 wrong repository", { repository: "justphilgud/other" }, upload],
    ["02 same repository name different owner", { repository: "attacker/pubquiz-web", repository_owner: "attacker" }, upload],
    ["03 wrong repository_id", { repository_id: "99999" }, upload],
    ["04 wrong owner_id", { repository_owner_id: "99999" }, upload],
    ["05 wrong branch", { ref: "refs/heads/preview" }, upload],
    ["06 wrong workflow repository", { workflow_ref: WORKFLOW.replace("justphilgud", "attacker") }, upload],
    ["07 other workflow even with correct requested audience", { workflow_ref: WORKFLOW.replace("ap94-acceptance.yml", "other.yml") }, upload],
    ["08 wrong audience", { aud: "attacker-audience" }, upload],
    ["09 wrong issuer", { iss: "https://attacker.invalid" }, upload],
    ["10 expired JWT", { exp: seconds - 1 }, upload],
    ["12 missing environment", { environment: undefined }, upload],
    ["13 arbitrary environment", { environment: "production" }, upload],
    ["14 backup tries restore", {}, { ...readback, operation: "restore-read" }],
    ["15 backup delete", {}, { ...readback, operation: "delete" }],
    ["16 backup requests overwrite", {}, { ...upload, allowOverwrite: true }],
    ["17 restore upload", restore, upload],
    ["18 restore delete", restore, { ...readback, operation: "delete" }],
    ["19 restore creates foreign path", restore, { ...upload, key: `${key}-new` }],
    ["20 manipulated subject", { sub: `${claims.sub}:other` }, upload],
    ["21 contradictory environment and subject", { environment: "operations-restore" }, upload],
    ["22 body claims backup role despite restore JWT", restore, { ...upload, role: "backup", environment: "operations-backup" }],
    ["23 traversal", {}, { ...upload, name: "../probe.bin" }],
    ["24 foreign run path", {}, { ...upload, key: key.replace("123456", "999999") }],
    ["25 wrong store", {}, { ...upload, store: "store_foreign" }],
    ["26 oversized upload", {}, { ...upload, bytes: 16385 }],
  ];
  let providerCalls = 0;
  const provider: BlobProvider = { async size() { providerCalls++; return null; }, async sign() { providerCalls++; return "unused"; } };
  const request = (token: string, body: object) => new Request("https://bridge.example/api/access", {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-role": "backup" }, body: JSON.stringify(body) });
  for (const [name, delta, body] of cases) await t.test(name, async () => {
    const token = await sign(delta);
    const result = await handleAccess(request(token, body), env, provider, (jwt, p) => verifyGithub(jwt, p, now, jwks));
    assert.equal(result.status, 403); assert.doesNotMatch(await result.text(), /eyJ|attacker|token=/);
  });
  await t.test("11 manipulated signature", async () => {
    const token = await sign({}); const parts = token.split(".");
    parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
    assert.equal((await handleAccess(request(parts.join("."), upload), env, provider, (jwt, p) => verifyGithub(jwt, p, now, jwks))).status, 403);
  });
  assert.equal(providerCalls, 0, "all invalid identities/operations rejected before any provider access");
  await t.test("restore cannot read a missing object as a way to create it", async () => {
    const result = await handleAccess(request(await sign(restore), { ...readback, operation: "restore-read" }), env, provider, (jwt, p) => verifyGithub(jwt, p, now, jwks));
    assert.equal(result.status, 403); assert.equal(await result.text(), '{"error":"OBJECT_MISSING"}');
    assert.equal(providerCalls, 1, "only existence read; no signing or object creation");
  });
  await t.test("29 tokens and signed URLs never escape through bridge logs/errors", async () => {
    const token = await sign({}); const secretUrl = "https://private.invalid/object?signature=SYNTHETIC_SECRET";
    const logged: unknown[][] = [];
    for (const method of ["log", "error", "warn", "info", "debug"] as const) t.mock.method(console, method, (...args: unknown[]) => { logged.push(args); });
    const failing: BlobProvider = { async size() { throw new Error(`${token} ${secretUrl}`); }, async sign() { throw new Error(secretUrl); } };
    const result = await handleAccess(request(token, upload), env, failing, (jwt, p) => verifyGithub(jwt, p, now, jwks));
    assert.equal(await result.text(), '{"error":"PROVIDER_REJECTED"}'); assert.deepEqual(logged, []);
    t.mock.restoreAll();
  });
});

test("real JWT signature verification: exact GitHub claims, expiry, issuer, audience, subject and immutable IDs", async () => {
  const keys = await generateKeyPair("RS256");
  const jwks = createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: "synthetic" }] });
  const sign = (changes: Record<string, unknown> = {}) => new SignJWT({ ...claims, ...changes }).setProtectedHeader({ alg: "RS256", kid: "synthetic" }).sign(keys.privateKey);
  assert.equal((await verifyGithub(await sign(), pins, now, jwks)).run, identity.run);
  for (const changes of [
    { repository: "other/repo" }, { repository_owner: "other" }, { repository_id: "99999" }, { repository_owner_id: "99999" },
    { ref: "refs/heads/other" }, { environment: "production" }, { workflow_ref: WORKFLOW.replace("ap94-acceptance", "evil") },
    { exp: seconds - 1 }, { nbf: seconds + 10 }, { iat: seconds - 301 }, { aud: "other" }, { iss: "https://evil.example" },
    { sub: "repo:other:environment:operations-backup" }, { event_name: "pull_request" }, { run_id: "../1" },
  ]) await assert.rejects(verifyGithub(await sign(changes), pins, now, jwks), /IDENTITY_REJECTED/);
  const immutable = `repo:justphilgud@${pins.ownerId}/pubquiz-web@${pins.repositoryId}:environment:operations-backup`;
  await assert.rejects(verifyGithub(await sign({ sub: immutable }), pins, now, jwks), /IDENTITY_REJECTED/);
  const foreignPins = { repositoryId: "99999", ownerId: "88888" };
  await assert.rejects(verifyGithub(await sign({ repository_id: foreignPins.repositoryId, repository_owner_id: foreignPins.ownerId }), foreignPins, now, jwks));
  assert.throws(() => configuration({ ...env, AP94_GITHUB_REPOSITORY_ID: foreignPins.repositoryId }));
  assert.throws(() => configuration({ ...env, AP94_GITHUB_OWNER_ID: foreignPins.ownerId }));
  const restoreClaims = { environment: "operations-restore", sub: `repo:${REPOSITORY}:environment:operations-restore` };
  assert.equal((await verifyGithub(await sign(restoreClaims), pins, now, jwks)).environment, "operations-restore");
  const alienKeys = await generateKeyPair("RS256");
  const forged = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "synthetic" }).sign(alienKeys.privateKey);
  await assert.rejects(verifyGithub(forged, pins, now, jwks), /IDENTITY_REJECTED/);
});

test("authorization denies cross-role operations, wildcard/store/path/traversal/size/overwrite/delete before provider", async () => {
  let calls = 0;
  const provider: BlobProvider = { async size() { calls++; return null; }, async sign() { calls++; return "unused"; } };
  for (const change of [
    { operation: "restore-read" }, { operation: "delete" }, { operation: "list" }, { store: "store_other" },
    { key: "production/acceptance/run-123456-1" }, { key: `${key}/*` }, { key: key.replace("123456", "999999") },
    { name: "../probe.bin" }, { name: "%2e%2e/probe.bin" }, { name: "x/probe.bin" }, { name: "*" },
    { kind: "database" }, { bytes: 16385 }, { bytes: -1 }, { bytes: 1.2 }, { bytes: 0 }, { allowOverwrite: true },
  ]) await assert.rejects(grantAccess({ ...upload, ...change }, identity, "synthetic", provider, now));
  await assert.rejects(grantAccess(upload, { ...identity, environment: "operations-restore" }, "synthetic", provider, now));
  await assert.rejects(grantAccess({ ...readback, operation: "restore-read" }, identity, "synthetic", provider, now));
  await assert.rejects(grantAccess(readback, { ...identity, environment: "operations-restore" }, "synthetic", provider, now));
  assert.equal(calls, 0);
});

test("synthetic object roundtrip, readback, restore read only and expiration (provider model, not live proof)", async () => {
  const objects = new Map<string, Buffer>(); const grants = new Map<string, Scope>(); let clock = now;
  const provider: BlobProvider = { async size(p) { return objects.get(p)?.length ?? null; }, async sign(s) { const u = `synthetic:${grants.size}`; grants.set(u, s); return u; } };
  function use(g: Grant, method: string, bytes?: Buffer) {
    const scope = grants.get(g.url)!; assert.ok(clock < scope.expiresAt, "expired"); assert.equal(method, scope.method);
    if (method === "PUT") { assert.ok(!objects.has(scope.pathname), "exists"); assert.ok(bytes && bytes.length <= scope.maximumSize); objects.set(scope.pathname, bytes); }
    return objects.get(scope.pathname);
  }
  await assert.rejects(grantAccess(readback, identity, "synthetic", provider, clock), /OBJECT_MISSING/);
  const put = await grantAccess(upload, identity, "synthetic", provider, clock);
  assert.throws(() => use(put, "PUT", Buffer.alloc(13)));
  use(put, "PUT", Buffer.from("hello world!"));
  assert.throws(() => use(put, "PUT", Buffer.from("hello world!")), /exists/);
  await assert.rejects(grantAccess(upload, identity, "synthetic", provider, clock), /OBJECT_EXISTS/);
  const get = await grantAccess(readback, identity, "synthetic", provider, clock);
  assert.equal(use(get, "GET")?.toString(), "hello world!");
  const restore = await grantAccess({ ...readback, operation: "restore-read" }, { ...identity, environment: "operations-restore" }, "synthetic", provider, clock);
  assert.equal(use(restore, "GET")?.toString(), "hello world!");
  assert.throws(() => use(restore, "DELETE")); assert.throws(() => use(restore, "PUT"));
  clock = get.expiresAt + 1; assert.throws(() => use(get, "GET"), /expired/);
});

test("provider adapter delegates one exact object/operation and signs enforced immutable bounded PUT", async () => {
  const calls: unknown[] = [];
  const provider = createBlobProvider({
    head: async () => { throw new Error("not used"); },
    issueSignedToken: async options => { calls.push(options); return { delegationToken: "synthetic", clientSigningToken: "synthetic", validUntil: now + TTL_MS }; },
    presignUrl: async (_token, options) => { calls.push(options); return { presignedUrl: "synthetic" }; },
  });
  const scope: Scope = { pathname: `${key}/probe.bin`, method: "PUT", maximumSize: 12, expiresAt: now + TTL_MS };
  await provider.sign(scope);
  const [delegation, url] = calls as [Record<string, unknown>, Record<string, unknown>];
  assert.deepEqual(delegation.operations, ["put"]); assert.equal(delegation.pathname, scope.pathname);
  assert.equal(delegation.storeId, STORE_ID); assert.equal(delegation.maximumSizeInBytes, 12);
  assert.equal(url.allowOverwrite, false); assert.equal(url.addRandomSuffix, false); assert.equal(url.access, "private");
  assert.equal(url.validUntil, scope.expiresAt); assert.deepEqual(url.allowedContentTypes, ["application/octet-stream"]);
  calls.length = 0; await provider.sign({ ...scope, method: "GET" });
  assert.deepEqual((calls[0] as Record<string, unknown>).operations, ["get"]);
  assert.equal("clientSigningToken" in (calls[1] as object), false);
});

test("HTTP boundary fails closed; redacts errors and rejects unsafe environment", async () => {
  for (const change of [{ VERCEL_ENV: "preview" }, { VERCEL_PROJECT_ID: "prj_pubquiz" }, { BLOB_STORE_ID: "other" },
    { DATABASE_URL: "synthetic-secret" }, { BLOB_READ_WRITE_TOKEN: "synthetic-secret" }, { AP94_BRIDGE_MODE: "" }]) assert.throws(() => configuration({ ...env, ...change }));
  const provider: BlobProvider = { async size() { throw new Error("https://secret.example?token=DO_NOT_LOG"); }, async sign() { throw new Error("unused"); } };
  const request = (body: string) => new Request("https://bridge.example/api/access", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer a.b.c" }, body });
  const res = await handleAccess(request(JSON.stringify(upload)), env, provider, async () => identity);
  assert.equal(res.status, 503); assert.equal(await res.text(), '{"error":"PROVIDER_REJECTED"}');
  assert.match(res.headers.get("cache-control")!, /no-store/);
  assert.equal((await handleAccess(request("x".repeat(3000)), env, provider, async () => identity)).status, 403);
  assert.equal((await handleAccess(request("{}"), env, provider, async () => { throw new Error("secret"); })).status, 403);
});

test("runner rejects wrong origin, cross-run keys, unaccepted real mode and expired grants", async () => {
  const e = { AP94_BRIDGE_ORIGIN: "https://pubquiz-backup-operations.vercel.app", AP94_TRANSPORT_MODE: "synthetic", GITHUB_RUN_ID: identity.run,
    GITHUB_RUN_ATTEMPT: identity.attempt, BACKUP_PRIVATE_BLOB_HOST: STORE_HOST };
  assert.throws(() => new BridgeClient({ ...e, AP94_BRIDGE_ORIGIN: "https://pubquiz-web.vercel.app" }, "backup", key));
  assert.throws(() => new BridgeClient(e, "backup", `${key}-other`));
  assert.throws(() => new BridgeClient({ ...e, AP94_TRANSPORT_MODE: "acceptance" }, "backup", key.replace("synthetic", "production")));
  const restore = new BridgeClient(e, "restore", key);
  await assert.rejects(restore.upload("probe.bin", Buffer.from("x")), /RESTORE_READ_ONLY/);
  assert.throws(() => validateGrant({ url: "secret", method: "PUT", expiresAt: now - 1, maximumSize: 12 }, { ...upload, operation: "backup-upload", kind: "probe" }, now), /SIGNED_GRANT_REJECTED/);
});

test("bridge package and runtime import boundary contain no application or database dependency", () => {
  const packageJson = JSON.parse(readFileSync(new URL("./bridge/package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), ["@vercel/blob", "jose"]);
  const config = JSON.parse(readFileSync(new URL("./bridge/vercel.json", import.meta.url), "utf8"));
  assert.equal(config.framework, null); assert.equal(config.git.deploymentEnabled, false);
  const restore = readFileSync(new URL("./acceptance-restore.ts", import.meta.url), "utf8");
  assert.doesNotMatch(restore, /store\.upload/);
  const workflow = readFileSync(new URL("../../.github/workflows/ap94-acceptance.yml", import.meta.url), "utf8");
  assert.equal((workflow.match(/id-token: write/g) ?? []).length, 2);
  assert.doesNotMatch(workflow, /BACKUP_BLOB_READ_WRITE_TOKEN|schedule:/);
  assert.match(workflow, /default: synthetic/); assert.match(workflow, /AP94_OIDC_TRANSPORT_ACCEPTED/);
});

test("runner-to-HTTP-to-SDK signed URLs roundtrip using synthetic provider and real JOSE verification", async () => {
  const keys = await generateKeyPair("RS256");
  const jwks = createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: "integration" }] });
  const jwt = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "integration" }).sign(keys.privateKey);
  const bytes = Buffer.from("hello world!"); let object: Buffer | null = null;
  const signingProvider = createBlobProvider({ head: async () => { throw new Error("unused"); }, issueSignedToken: async options => ({
    delegationToken: `${Buffer.from(JSON.stringify({ ...options, storeId: STORE_ID })).toString("base64url")}.synthetic`,
    clientSigningToken: Buffer.alloc(32, 7).toString("base64url"), validUntil: identity.expiresAt }), presignUrl });
  const provider: BlobProvider = { async size() { return object?.length ?? null; }, sign: signingProvider.sign };
  const e = { AP94_BRIDGE_ORIGIN: "https://pubquiz-backup-operations.vercel.app", AP94_TRANSPORT_MODE: "synthetic", GITHUB_RUN_ID: identity.run,
    GITHUB_RUN_ATTEMPT: identity.attempt, BACKUP_PRIVATE_BLOB_HOST: STORE_HOST, ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-request-token",
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.actions.githubusercontent.com/idtoken" };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal(init?.redirect, "error");
    if (url.hostname === "example.actions.githubusercontent.com") {
      assert.equal(url.searchParams.get("audience"), AUDIENCE); return Response.json({ value: jwt });
    }
    if (url.origin === e.AP94_BRIDGE_ORIGIN) return handleAccess(new Request(url, init), env, provider, (token, p) => verifyGithub(token, p, Date.now(), jwks));
    assert.ok(url.searchParams.has("vercel-blob-signature"));
    if (init?.method === "PUT") {
      assert.equal(url.origin, "https://vercel.com"); assert.equal(url.searchParams.get("pathname"), `${key}/probe.bin`);
      object = Buffer.from(init.body as Uint8Array);
      return Response.json({ url: `https://${STORE_HOST}/${key}/probe.bin` });
    }
    assert.equal(url.hostname, STORE_HOST); assert.ok(object); return new Response(new Uint8Array(object));
  };
  const client = new BridgeClient(e, "backup", key, fetcher);
  await client.upload("probe.bin", bytes); assert.deepEqual(await client.read("probe.bin"), bytes);
  await assert.rejects(client.upload("probe.bin", bytes), /BRIDGE_ACCESS_REJECTED/);
});
