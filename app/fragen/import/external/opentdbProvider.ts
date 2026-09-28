import type {
  ExternalQuestion,
  ExternalQuestionProvider,
  OpenTdbApiQuestion,
  OpenTdbDifficulty,
} from "./types";
import { EXTERNAL_QUESTION_PROVIDER } from "./types";
import { normalizeOpenTdbQuestion } from "./normalize";

const API_URL = "https://opentdb.com/api.php";
const TOKEN_URL = "https://opentdb.com/api_token.php?command=request";
const MAX_PER_REQUEST = 50;

type FetchLike = typeof fetch;

type OpenTdbTokenResponse = {
  response_code: number;
  response_message?: string;
  token?: string;
};

type OpenTdbQuestionResponse = {
  response_code: number;
  results?: OpenTdbApiQuestion[];
};

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("OPENTDB_INVALID_RESPONSE");
  }
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function allocation(count: number): Array<{ difficulty: OpenTdbDifficulty; count: number }> {
  const base = Math.floor(count / 3);
  const remainder = count % 3;
  return (["easy", "medium", "hard"] as const).map((difficulty, index) => ({
    difficulty,
    count: base + (index < remainder ? 1 : 0),
  }));
}

export class OpenTdbProvider implements ExternalQuestionProvider {
  readonly id = EXTERNAL_QUESTION_PROVIDER;
  private lastRequestAt = 0;

  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly wait: (milliseconds: number) => Promise<void> = sleep,
    private readonly minimumRequestIntervalMs = fetchImpl === fetch ? 5_500 : 0,
  ) {}

  private async requestJson(url: string | URL): Promise<unknown> {
    const maximumAttempts = 4;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      const waitForInterval = Math.max(
        0,
        this.minimumRequestIntervalMs - (Date.now() - this.lastRequestAt),
      );
      if (waitForInterval > 0) await this.wait(waitForInterval);
      const response = await this.fetchImpl(url, { cache: "no-store" });
      this.lastRequestAt = Date.now();
      if (response.ok) return response.json();
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maximumAttempts) {
        throw new Error(`OPENTDB_HTTP_${response.status}`);
      }
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const retryAfterMs = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1000
        : this.minimumRequestIntervalMs || 1_000;
      await this.wait(Math.max(retryAfterMs, this.minimumRequestIntervalMs));
      this.lastRequestAt = 0;
    }
    throw new Error("OPENTDB_REQUEST_FAILED");
  }

  async fetchQuestions({
    count,
    excludeExternalReferences = [],
  }: {
    count: number;
    excludeExternalReferences?: readonly string[];
  }): Promise<ExternalQuestion[]> {
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new Error("OPENTDB_COUNT_INVALID");
    }
    const tokenRaw = await this.requestJson(TOKEN_URL);
    assertRecord(tokenRaw);
    const token = (tokenRaw as OpenTdbTokenResponse).token;
    if ((tokenRaw as OpenTdbTokenResponse).response_code !== 0 || !token) {
      throw new Error("OPENTDB_TOKEN_FAILED");
    }

    const excluded = new Set(excludeExternalReferences);
    const normalized: ExternalQuestion[] = [];
    for (const part of allocation(count)) {
      const collected = new Map<string, ExternalQuestion>();
      let requests = 0;
      while (collected.size < part.count && requests < 4) {
        const amount = Math.min(part.count - collected.size, MAX_PER_REQUEST);
        const url = new URL(API_URL);
        url.searchParams.set("amount", String(amount));
        url.searchParams.set("difficulty", part.difficulty);
        url.searchParams.set("type", "multiple");
        url.searchParams.set("encode", "url3986");
        url.searchParams.set("token", token);
        const raw = await this.requestJson(url);
        assertRecord(raw);
        const payload = raw as OpenTdbQuestionResponse;
        if (payload.response_code !== 0 || !Array.isArray(payload.results)) {
          throw new Error(`OPENTDB_RESPONSE_${payload.response_code}`);
        }
        requests += 1;
        for (const item of payload.results) {
          const parsed = normalizeOpenTdbQuestion(item);
          if (parsed && !excluded.has(parsed.externalReference)) {
            collected.set(parsed.externalReference, parsed);
          }
        }
      }
      if (collected.size !== part.count) {
        throw new Error("OPENTDB_UNIQUE_COUNT_MISMATCH");
      }
      normalized.push(...collected.values());
    }

    const unique = [...new Map(normalized.map((item) => [item.externalReference, item])).values()];
    if (unique.length !== count) throw new Error("OPENTDB_UNIQUE_COUNT_MISMATCH");
    return unique;
  }
}
