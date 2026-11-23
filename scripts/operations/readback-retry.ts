import { retryAfterMilliseconds, type UploadRetryRuntime } from "./upload-retry";

export const MAX_PRIVATE_READBACK_ATTEMPTS = 4;

export function isRetryablePrivateReadbackStatus(status: number) {
  return status === 429 || (status >= 500 && status <= 599);
}

export function privateReadbackRetryDelay(response: Response, attempt: number, runtime: UploadRetryRuntime) {
  return retryAfterMilliseconds(response, runtime.now()) ??
    500 * (2 ** (attempt - 1)) + Math.floor(Math.max(0, Math.min(0.999999, runtime.random())) * 250);
}
