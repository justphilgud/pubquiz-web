import { setTimeout as delay } from "node:timers/promises";
import { OperationsError, requireCondition } from "./guards";

type Env = Readonly<Record<string, string | undefined>>;

export const MAX_GITHUB_OIDC_ATTEMPTS = 4;
export const GITHUB_OIDC_REFRESH_MARGIN_MS = 60_000;
const MAX_RETRY_AFTER_MS = 30_000;
const BASE_DELAY_MS = 500;
const MAX_JITTER_MS = 250;

export type OidcRuntime = {
  sleep(ms: number): Promise<void>;
  random(): number;
  now(): number;
};

export type OidcDiagnostics = {
  bridgeCalls: number;
  tokenRequests: number;
  cacheHits: number;
  singleFlightJoins: number;
  refreshes: number;
  retries: number;
  finalErrorClass: string | null;
};

export const defaultOidcRuntime: OidcRuntime = {
  sleep: ms => delay(ms),
  random: Math.random,
  now: Date.now,
};

function retryableStatus(status: number) {
  return status === 429 || (status >= 500 && status <= 599);
}

function retryAfterMilliseconds(response: Response, now: number) {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  const parsed = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : Date.parse(value) - now;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(MAX_RETRY_AFTER_MS, Math.ceil(parsed));
}

function backoffMilliseconds(response: Response | null, retryNumber: number, runtime: OidcRuntime) {
  const retryAfter = response ? retryAfterMilliseconds(response, runtime.now()) : null;
  if (retryAfter !== null) return retryAfter;
  const jitter = Math.floor(Math.max(0, Math.min(0.999999, runtime.random())) * MAX_JITTER_MS);
  return BASE_DELAY_MS * (2 ** (retryNumber - 1)) + jitter;
}

async function boundedResponse(response: Response, limit: number) {
  requireCondition(response.body, "GITHUB_OIDC_RESPONSE_INVALID");
  const reader = response.body.getReader(); const parts: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const item = await reader.read(); if (item.done) break;
      size += item.value.length; requireCondition(size <= limit, "GITHUB_OIDC_RESPONSE_INVALID"); parts.push(item.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(parts);
}

function expirationMilliseconds(token: string, now: number) {
  try {
    const parts = token.split(".");
    requireCondition(parts.length === 3 && parts.every(part => /^[A-Za-z0-9_-]+$/.test(part)), "GITHUB_OIDC_TOKEN_INVALID");
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as { exp?: unknown };
    requireCondition(Number.isSafeInteger(claims.exp) && (claims.exp as number) > 0, "GITHUB_OIDC_TOKEN_EXP_INVALID");
    const expiresAt = (claims.exp as number) * 1000;
    requireCondition(expiresAt - now > GITHUB_OIDC_REFRESH_MARGIN_MS, "GITHUB_OIDC_TOKEN_TOO_SHORT");
    return expiresAt;
  } catch (error) {
    if (error instanceof OperationsError) throw error;
    throw new OperationsError("GITHUB_OIDC_TOKEN_INVALID");
  }
}

function oidcEndpoint(env: Env, audience: string) {
  try {
    requireCondition(/^[A-Za-z0-9:._/-]{1,200}$/.test(audience), "GITHUB_OIDC_AUDIENCE_INVALID");
    const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL ?? "");
    requireCondition(url.protocol === "https:" && url.hostname.endsWith(".actions.githubusercontent.com") && !url.port &&
      !url.username && !url.password && !url.hash && !!env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, "GITHUB_OIDC_UNAVAILABLE");
    url.searchParams.set("audience", audience);
    return url;
  } catch (error) {
    if (error instanceof OperationsError) throw error;
    throw new OperationsError("GITHUB_OIDC_UNAVAILABLE");
  }
}

export class GithubOidcTokenProvider {
  private readonly cache = new Map<string, { token: string; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<string>>();
  private readonly metrics: OidcDiagnostics = {
    bridgeCalls: 0, tokenRequests: 0, cacheHits: 0, singleFlightJoins: 0, refreshes: 0, retries: 0, finalErrorClass: null,
  };

  constructor(private readonly env: Env, private readonly request: typeof fetch = fetch,
    private readonly runtime: OidcRuntime = defaultOidcRuntime) {}

  recordBridgeCall() { this.metrics.bridgeCalls += 1; }

  diagnostics(): OidcDiagnostics { return { ...this.metrics }; }

  async token(audience: string): Promise<string> {
    const cached = this.cache.get(audience);
    if (cached && cached.expiresAt - this.runtime.now() > GITHUB_OIDC_REFRESH_MARGIN_MS) {
      this.metrics.cacheHits += 1; return cached.token;
    }
    const pending = this.inFlight.get(audience);
    if (pending) { this.metrics.singleFlightJoins += 1; return pending; }
    const refresh = cached !== undefined;
    const acquisition = this.acquire(audience, refresh);
    this.inFlight.set(audience, acquisition);
    try { return await acquisition; }
    finally { this.inFlight.delete(audience); }
  }

  private async acquire(audience: string, refresh: boolean): Promise<string> {
    try {
      const url = oidcEndpoint(this.env, audience);
      for (let attempt = 1; attempt <= MAX_GITHUB_OIDC_ATTEMPTS; attempt++) {
        let response: Response;
        this.metrics.tokenRequests += 1;
        try {
          response = await this.request(url, { headers: { authorization: `Bearer ${this.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
            redirect: "error", signal: AbortSignal.timeout(15000) });
        } catch {
          if (attempt === MAX_GITHUB_OIDC_ATTEMPTS) throw new OperationsError("GITHUB_OIDC_NETWORK_FAILED");
          this.metrics.retries += 1;
          await this.runtime.sleep(backoffMilliseconds(null, attempt, this.runtime));
          continue;
        }
        if (!response.ok) {
          const retryable = retryableStatus(response.status);
          await response.body?.cancel().catch(() => undefined);
          if (!retryable || attempt === MAX_GITHUB_OIDC_ATTEMPTS) {
            throw new OperationsError(`GITHUB_OIDC_HTTP_${response.status}`);
          }
          this.metrics.retries += 1;
          await this.runtime.sleep(backoffMilliseconds(response, attempt, this.runtime));
          continue;
        }
        let raw: Buffer;
        try { raw = await boundedResponse(response, 20_000); }
        catch (error) {
          if (error instanceof OperationsError) throw error;
          if (attempt === MAX_GITHUB_OIDC_ATTEMPTS) throw new OperationsError("GITHUB_OIDC_NETWORK_FAILED");
          this.metrics.retries += 1;
          await this.runtime.sleep(backoffMilliseconds(null, attempt, this.runtime));
          continue;
        }
        let data: { value?: unknown };
        try { data = JSON.parse(raw.toString()) as { value?: unknown }; }
        catch { throw new OperationsError("GITHUB_OIDC_RESPONSE_INVALID"); }
        requireCondition(typeof data.value === "string" && data.value.length <= 16_000, "GITHUB_OIDC_RESPONSE_INVALID");
        const expiresAt = expirationMilliseconds(data.value, this.runtime.now());
        this.cache.set(audience, { token: data.value, expiresAt });
        if (refresh) this.metrics.refreshes += 1;
        this.metrics.finalErrorClass = null;
        return data.value;
      }
      throw new OperationsError("GITHUB_OIDC_NETWORK_FAILED");
    } catch (error) {
      const classified = error instanceof OperationsError ? error : new OperationsError("GITHUB_OIDC_FAILED_DETAILS_WITHHELD");
      this.metrics.finalErrorClass = classified.code;
      throw classified;
    }
  }
}
