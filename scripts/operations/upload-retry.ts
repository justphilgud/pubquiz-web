import { setTimeout as delay } from "node:timers/promises";

export const MAX_PRIVATE_UPLOAD_ATTEMPTS = 4;
const MAX_RETRY_AFTER_MS = 60_000;
const BASE_DELAY_MS = 500;
const MAX_JITTER_MS = 250;

export type UploadRetryRuntime = {
  sleep(ms: number): Promise<void>;
  random(): number;
  now(): number;
};

export type SafeUploadResponse = {
  status: number;
  endpointClass: "vercel-blob-signed-put";
  retryAfterMs: number | null;
  providerRequestId: string | null;
  providerTraceId: string | null;
};

export type UploadRetryEvent = SafeUploadResponse & {
  attempt: number;
  maximumAttempts: number;
  delayMs: number;
};

export const defaultUploadRetryRuntime: UploadRetryRuntime = {
  sleep: ms => delay(ms),
  random: Math.random,
  now: Date.now,
};

export function isRetryableUploadStatus(status: number) {
  return status === 429 || (status >= 500 && status <= 599);
}

function safeHeader(response: Response, names: string[]) {
  for (const name of names) {
    const value = response.headers.get(name);
    if (value && /^[A-Za-z0-9._:/ -]{1,200}$/.test(value)) return value;
  }
  return null;
}

export function retryAfterMilliseconds(response: Response, now = Date.now()) {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  const parsed = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : Date.parse(value) - now;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(MAX_RETRY_AFTER_MS, Math.ceil(parsed));
}

export function safeUploadResponse(response: Response, now = Date.now()): SafeUploadResponse {
  return {
    status: response.status,
    endpointClass: "vercel-blob-signed-put",
    retryAfterMs: retryAfterMilliseconds(response, now),
    providerRequestId: safeHeader(response, ["x-vercel-request-id", "x-request-id"]),
    providerTraceId: safeHeader(response, ["x-vercel-id", "x-vercel-trace-id"]),
  };
}

function backoffMilliseconds(response: Response, retryNumber: number, runtime: UploadRetryRuntime) {
  const retryAfter = retryAfterMilliseconds(response, runtime.now());
  if (retryAfter !== null) return retryAfter;
  const jitter = Math.floor(Math.max(0, Math.min(0.999999, runtime.random())) * MAX_JITTER_MS);
  return BASE_DELAY_MS * (2 ** (retryNumber - 1)) + jitter;
}

export async function uploadWithBoundedRetry(options: {
  send(attempt: number): Promise<Response>;
  reconcile(): Promise<boolean>;
  onRetry(event: UploadRetryEvent): void;
  runtime?: UploadRetryRuntime;
}) {
  const runtime = options.runtime ?? defaultUploadRetryRuntime;
  let priorTransientFailure = false;
  for (let attempt = 1; attempt <= MAX_PRIVATE_UPLOAD_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await options.send(attempt);
    } catch (error) {
      if (priorTransientFailure && await options.reconcile()) return { response: null, reconciled: true, attempts: attempt } as const;
      throw error;
    }
    if (response.ok) return { response, reconciled: false, attempts: attempt } as const;
    const retryable = isRetryableUploadStatus(response.status);
    if (!retryable) {
      if (priorTransientFailure && [409, 412].includes(response.status) && await options.reconcile()) {
        await response.body?.cancel().catch(() => undefined);
        return { response: null, reconciled: true, attempts: attempt } as const;
      }
      return { response, reconciled: false, attempts: attempt } as const;
    }
    priorTransientFailure = true;
    if (attempt < MAX_PRIVATE_UPLOAD_ATTEMPTS) await response.body?.cancel().catch(() => undefined);
    if (await options.reconcile()) return { response: null, reconciled: true, attempts: attempt } as const;
    if (attempt === MAX_PRIVATE_UPLOAD_ATTEMPTS) return { response, reconciled: false, attempts: attempt } as const;
    const delayMs = backoffMilliseconds(response, attempt, runtime);
    options.onRetry({ ...safeUploadResponse(response, runtime.now()), attempt,
      maximumAttempts: MAX_PRIVATE_UPLOAD_ATTEMPTS, delayMs });
    await runtime.sleep(delayMs);
  }
  throw new Error("unreachable");
}
