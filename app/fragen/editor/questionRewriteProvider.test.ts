import assert from "node:assert/strict";
import test from "node:test";
import { MistralQuestionRewriteProvider, QuestionRewriteProviderError } from "./questionRewriteProvider.server";

test("Mistral provider sends only question data and returns usage plus configured cost", async () => {
  let requestBody: Record<string, unknown> | null = null;
  const provider = new MistralQuestionRewriteProvider({
    apiKey: "test-key", model: "mistral-small-latest",
    inputEuroPerMillionTokens: 1, outputEuroPerMillionTokens: 3,
    fetch: (async (_url, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-key");
      return Response.json({ choices: [{ message: { content: JSON.stringify({ proposal: "Wie lautet die Hauptstadt Frankreichs?" }) } }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } });
    }) as typeof fetch,
  });
  const result = await provider.rewrite("Wie heisst die Hauptstadt von Frankreich?");
  assert.equal(result.proposal, "Wie lautet die Hauptstadt Frankreichs?");
  assert.deepEqual(result.usage, { promptTokens: 100, completionTokens: 20, totalTokens: 120 });
  assert.equal(result.cost?.amountEuro, 0.00016);
  assert.ok(requestBody);
  const capturedBody = requestBody as Record<string, unknown>;
  const messages = capturedBody.messages as Array<{ role: string; content: string }>;
  assert.equal(messages.at(-1)?.content, JSON.stringify({ questionText: "Wie heisst die Hauptstadt von Frankreich?" }));
  assert.equal(JSON.stringify(capturedBody).includes("Paris"), false);
  assert.deepEqual(capturedBody.response_format, { type: "json_object" });
});

test("cost stays unavailable without explicit pricing configuration", async () => {
  const provider = new MistralQuestionRewriteProvider({ apiKey: "test-key", fetch: (async () => Response.json({ choices: [{ message: { content: JSON.stringify({ proposal: "Bessere Frage?" }) } }], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } })) as typeof fetch });
  assert.equal((await provider.rewrite("Alte Frage?")).cost, null);
});

test("invalid provider output is rejected instead of changing editor text", async () => {
  const provider = new MistralQuestionRewriteProvider({ apiKey: "test-key", fetch: (async () => Response.json({ choices: [{ message: { content: "not-json" } }] })) as typeof fetch });
  await assert.rejects(provider.rewrite("Alte Frage?"), (error: unknown) => error instanceof QuestionRewriteProviderError && error.code === "INVALID_RESPONSE");
});

test("changed numbers or quotations are rejected", async () => {
  const provider = new MistralQuestionRewriteProvider({ apiKey: "test-key", fetch: (async () => Response.json({ choices: [{ message: { content: JSON.stringify({ proposal: "Welches Werk erschien 1985 unter „Neu“?" }) } }] })) as typeof fetch });
  await assert.rejects(provider.rewrite("Welches Werk erschien 1984 unter „Alt“?"), (error: unknown) => error instanceof QuestionRewriteProviderError && error.code === "INVALID_RESPONSE");
});

test("provider timeout and missing credentials are qualified", async () => {
  await assert.rejects(new MistralQuestionRewriteProvider({ apiKey: "" }).rewrite("Alte Frage?"), (error: unknown) => error instanceof QuestionRewriteProviderError && error.code === "NOT_CONFIGURED");
  const hanging = new MistralQuestionRewriteProvider({ apiKey: "test-key", timeoutMs: 5, fetch: (async (_url, init) => new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))); })) as typeof fetch });
  await assert.rejects(hanging.rewrite("Alte Frage?"), (error: unknown) => error instanceof QuestionRewriteProviderError && error.code === "TIMEOUT");
});
