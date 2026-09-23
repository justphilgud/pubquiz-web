import assert from "node:assert/strict";
import test from "node:test";
import { OperationsError } from "./guards";
import { MAX_PRIVATE_UPLOAD_ATTEMPTS, retryAfterMilliseconds, safeUploadResponse, uploadWithBoundedRetry,
  type UploadRetryRuntime } from "./upload-retry";

function runtime(now = 1_700_000_000_000) {
  const waits: number[] = [];
  const value: UploadRetryRuntime = { sleep: async ms => { waits.push(ms); }, random: () => 0, now: () => now };
  return { value, waits };
}

test("retries 503 with a fresh send and bounded exponential delay", async () => {
  const clock = runtime(); let sends = 0; let reconciles = 0;
  const result = await uploadWithBoundedRetry({
    runtime: clock.value,
    send: async () => ++sends === 1 ? new Response("unavailable", { status: 503 }) : new Response("{}", { status: 200 }),
    reconcile: async () => { reconciles++; return false; }, onRetry: event => assert.equal(event.status, 503),
  });
  assert.equal(result.response?.status, 200); assert.equal(result.attempts, 2);
  assert.equal(sends, 2); assert.equal(reconciles, 1); assert.deepEqual(clock.waits, [500]);
});

test("honors bounded Retry-After for 429 and never retries 400/401/403", async () => {
  const clock = runtime(); let sends = 0;
  const result = await uploadWithBoundedRetry({
    runtime: clock.value,
    send: async () => ++sends === 1 ? new Response(null, { status: 429, headers: { "retry-after": "2" } }) : new Response(null, { status: 204 }),
    reconcile: async () => false, onRetry: () => undefined,
  });
  assert.equal(result.response?.status, 204); assert.deepEqual(clock.waits, [2000]);
  for (const status of [400, 401, 403]) {
    let attempts = 0; const waits = runtime();
    const denied = await uploadWithBoundedRetry({ runtime: waits.value, send: async () => { attempts++; return new Response(null, { status }); },
      reconcile: async () => { throw new Error("must not reconcile"); }, onRetry: () => { throw new Error("must not retry"); } });
    assert.equal(denied.response?.status, status); assert.equal(attempts, 1); assert.deepEqual(waits.waits, []);
  }
});

test("stops after four transient attempts", async () => {
  const clock = runtime(); let sends = 0; let reconciles = 0;
  const result = await uploadWithBoundedRetry({ runtime: clock.value,
    send: async () => { sends++; return new Response('{"error":"service_unavailable"}', { status: 503 }); },
    reconcile: async () => { reconciles++; return false; }, onRetry: () => undefined });
  assert.equal(result.response?.status, 503); assert.equal(result.attempts, MAX_PRIVATE_UPLOAD_ATTEMPTS);
  assert.equal(sends, 4); assert.equal(reconciles, 4); assert.deepEqual(clock.waits, [500, 1000, 2000]);
  assert.equal(await result.response?.text(), '{"error":"service_unavailable"}');
});

test("reconciles an ambiguous successful write and rejects a hash conflict", async () => {
  const reconciled = await uploadWithBoundedRetry({ send: async () => new Response(null, { status: 503 }),
    reconcile: async () => true, onRetry: () => { throw new Error("must not retry"); }, runtime: runtime().value });
  assert.equal(reconciled.response, null); assert.equal(reconciled.reconciled, true); assert.equal(reconciled.attempts, 1);
  await assert.rejects(uploadWithBoundedRetry({ send: async () => new Response(null, { status: 503 }),
    reconcile: async () => { throw new OperationsError("PRIVATE_UPLOAD_HASH_CONFLICT"); }, onRetry: () => undefined,
    runtime: runtime().value }), /PRIVATE_UPLOAD_HASH_CONFLICT/);
});

test("recovers when a retry grant observes the first write and preserves safe diagnostics", async () => {
  let sends = 0; let reconciles = 0;
  const result = await uploadWithBoundedRetry({ runtime: runtime().value,
    send: async () => { sends++; if (sends === 1) return new Response(null, { status: 503 }); throw new OperationsError("BRIDGE_ACCESS_REJECTED"); },
    reconcile: async () => ++reconciles === 2, onRetry: () => undefined });
  assert.equal(result.reconciled, true); assert.equal(sends, 2); assert.equal(reconciles, 2);
  const response = new Response("provider secret body", { status: 503, headers: {
    "retry-after": "120", "x-vercel-request-id": "fra1::abc-123", "x-vercel-id": "malicious?secret=1", "authorization": "secret",
  } });
  assert.equal(retryAfterMilliseconds(response), 60_000);
  assert.deepEqual(safeUploadResponse(response), { status: 503, endpointClass: "vercel-blob-signed-put", retryAfterMs: 60_000,
    providerRequestId: "fra1::abc-123", providerTraceId: null });
});
