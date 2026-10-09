import assert from "node:assert/strict";
import test from "node:test";
import {
  OpenAIQuestionRewriteProvider,
  QuestionRewriteProviderError,
} from "./questionRewriteProvider.server";

function openAIResponse(
  proposal: string,
  usage = { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
) {
  return {
    status: "completed",
    output: [{
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify({ proposal }) }],
    }],
    usage,
  };
}

test("OpenAI provider uses Responses Structured Outputs and sends only question data", async () => {
  let requestUrl = "";
  let requestBody: Record<string, unknown> | null = null;
  const provider = new OpenAIQuestionRewriteProvider({
    apiKey: "test-key",
    model: "gpt-5.6-luna",
    inputUsdPerMillionTokens: 0.2,
    outputUsdPerMillionTokens: 1.2,
    fetch: (async (url, init) => {
      requestUrl = String(url);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer test-key",
      );
      return Response.json(openAIResponse("Wie lautet die Hauptstadt Frankreichs?"));
    }) as typeof fetch,
  });

  const result = await provider.rewrite(
    "Wie heisst die Hauptstadt von Frankreich?",
  );
  assert.equal(requestUrl, "https://api.openai.com/v1/responses");
  assert.equal(result.proposal, "Wie lautet die Hauptstadt Frankreichs?");
  assert.deepEqual(result.usage, {
    promptTokens: 100,
    completionTokens: 20,
    totalTokens: 120,
  });
  assert.equal(result.cost?.amountUsd, 0.000044);
  assert.ok(requestBody);
  const capturedBody = requestBody as Record<string, unknown>;
  assert.equal(capturedBody.model, "gpt-5.6-luna");
  assert.equal(capturedBody.store, false);
  assert.equal(
    capturedBody.input,
    JSON.stringify({
      questionText: "Wie heisst die Hauptstadt von Frankreich?",
    }),
  );
  assert.equal(JSON.stringify(capturedBody).includes("Paris"), false);
  assert.equal(JSON.stringify(capturedBody).includes("answer"), false);
  assert.deepEqual(capturedBody.reasoning, { effort: "none" });
  assert.deepEqual(capturedBody.text, {
    format: {
      type: "json_schema",
      name: "question_rewrite",
      strict: true,
      schema: {
        type: "object",
        properties: { proposal: { type: "string" } },
        required: ["proposal"],
        additionalProperties: false,
      },
    },
  });
  assert.match(String(capturedBody.instructions), /Eigennamen/);
  assert.match(String(capturedBody.instructions), /unverändert zurück/);
  assert.match(String(capturedBody.instructions), /keine Anführungszeichen hinzu/);
});

test("cost stays unavailable without explicit pricing configuration", async () => {
  const provider = new OpenAIQuestionRewriteProvider({
    apiKey: "test-key",
    fetch: (async () => Response.json(openAIResponse("Bessere Frage?"))) as typeof fetch,
  });
  assert.equal((await provider.rewrite("Alte Frage?")).cost, null);
});

test("invalid, refused, incomplete, or extra provider output is rejected", async () => {
  const responses = [
    { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "not-json" }] }] },
    { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] },
    { status: "incomplete", output: [] },
    { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ proposal: "Neu?", answer: "Nein" }) }] }] },
  ];
  for (const response of responses) {
    const provider = new OpenAIQuestionRewriteProvider({
      apiKey: "test-key",
      fetch: (async () => Response.json(response)) as typeof fetch,
    });
    await assert.rejects(
      provider.rewrite("Alte Frage?"),
      (error: unknown) =>
        error instanceof QuestionRewriteProviderError &&
        error.code === "INVALID_RESPONSE",
    );
  }
});

test("changed numbers or quotations are rejected", async () => {
  const provider = new OpenAIQuestionRewriteProvider({
    apiKey: "test-key",
    fetch: (async () =>
      Response.json(
        openAIResponse("Welches Werk erschien 1985 unter „Neu“?"),
      )) as typeof fetch,
  });
  await assert.rejects(
    provider.rewrite("Welches Werk erschien 1984 unter „Alt“?"),
    (error: unknown) =>
      error instanceof QuestionRewriteProviderError &&
      error.code === "INVALID_RESPONSE",
  );
});

test("provider rate limit, timeout, and missing credentials are qualified", async () => {
  await assert.rejects(
    new OpenAIQuestionRewriteProvider({ apiKey: "" }).rewrite("Alte Frage?"),
    (error: unknown) =>
      error instanceof QuestionRewriteProviderError &&
      error.code === "NOT_CONFIGURED",
  );
  await assert.rejects(
    new OpenAIQuestionRewriteProvider({
      apiKey: "test-key",
      fetch: (async () => new Response(null, { status: 429 })) as typeof fetch,
    }).rewrite("Alte Frage?"),
    (error: unknown) =>
      error instanceof QuestionRewriteProviderError &&
      error.code === "RATE_LIMIT",
  );
  await assert.rejects(
    new OpenAIQuestionRewriteProvider({
      apiKey: "invalid-test-key",
      fetch: (async () => new Response(null, { status: 401 })) as typeof fetch,
    }).rewrite("Alte Frage?"),
    (error: unknown) =>
      error instanceof QuestionRewriteProviderError &&
      error.code === "UNAVAILABLE",
  );
  const hanging = new OpenAIQuestionRewriteProvider({
    apiKey: "test-key",
    timeoutMs: 5,
    fetch: (async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")));
      })) as typeof fetch,
  });
  await assert.rejects(
    hanging.rewrite("Alte Frage?"),
    (error: unknown) =>
      error instanceof QuestionRewriteProviderError &&
      error.code === "TIMEOUT",
  );
});
