import assert from "node:assert/strict";
import test from "node:test";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { questionRewriteResponse } from "./questionRewriteEndpoint";
import { QuestionRewriteProviderError, type QuestionRewriteProvider } from "./questionRewriteProvider.server";

const editor: AuthorizationActor = { userId: 2, assignments: [{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }] };
const request = (questionText = "Alte Frage?") => new Request("http://localhost/api/question-rewrite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionText }) });
function dependencies(input: { enabled?: boolean; actor?: AuthorizationActor | null; acquire?: boolean; provider?: QuestionRewriteProvider } = {}) {
  return {
    enabled: () => input.enabled ?? true,
    actor: async () => input.actor === undefined ? editor : input.actor,
    rateLimit: { acquire: () => input.acquire ?? true },
    provider: () => input.provider ?? { rewrite: async () => ({ proposal: "Bessere Frage?", usage: { promptTokens: 8, completionTokens: 3, totalTokens: 11 }, cost: null }) },
  };
}

test("disabled feature fails before provider invocation", async () => {
  let providerCalled = false;
  const response = await questionRewriteResponse(request(), dependencies({ enabled: false, provider: { rewrite: async () => { providerCalled = true; throw new Error("must not run"); } } }));
  assert.equal(response.status, 404);
  assert.equal(providerCalled, false);
});

test("unauthorized and non-editor callers are rejected", async () => {
  assert.equal((await questionRewriteResponse(request(), dependencies({ actor: null }))).status, 401);
  assert.equal((await questionRewriteResponse(request(), dependencies({ actor: { userId: 3, assignments: [] } }))).status, 403);
  assert.equal((await questionRewriteResponse(request(), dependencies({ actor: { userId: 4, assignments: [{ role: "EVENT_MANAGER", scopeType: "EVENT_SERIES", eventSeriesId: 1 }] } }))).status, 403);
});

test("invalid and repeated requests are rejected before provider invocation", async () => {
  assert.equal((await questionRewriteResponse(request(""), dependencies())).status, 400);
  assert.equal((await questionRewriteResponse(request(), dependencies({ acquire: false }))).status, 429);
});

test("successful response contains proposal and usage without persistence", async () => {
  const response = await questionRewriteResponse(request(), dependencies());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, proposal: "Bessere Frage?", usage: { promptTokens: 8, completionTokens: 3, totalTokens: 11 }, cost: null });
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("endpoint forwards only the validated question text to the provider", async () => {
  let forwarded = "";
  const response = await questionRewriteResponse(
    new Request("http://localhost/api/question-rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionText: "  Alte Frage?  ",
        answers: ["Geheime Antwort"],
        solution: "Geheime Lösung",
        media: { url: "https://example.invalid/secret.jpg" },
      }),
    }),
    dependencies({
      provider: {
        rewrite: async (questionText) => {
          forwarded = questionText;
          return { proposal: "Bessere Frage?", usage: null, cost: null };
        },
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(forwarded, "Alte Frage?");
});

for (const scenario of [["TIMEOUT", 504, "PROVIDER_TIMEOUT"], ["RATE_LIMIT", 429, "PROVIDER_RATE_LIMIT"], ["INVALID_RESPONSE", 502, "PROVIDER_RESPONSE_INVALID"], ["UNAVAILABLE", 503, "PROVIDER_UNAVAILABLE"], ["NOT_CONFIGURED", 503, "NOT_CONFIGURED"]] as const) {
  test(`provider ${scenario[0]} is mapped to a safe response`, async () => {
    const response = await questionRewriteResponse(request(), dependencies({ provider: { rewrite: async () => { throw new QuestionRewriteProviderError(scenario[0]); } } }));
    assert.equal(response.status, scenario[1]);
    assert.deepEqual(await response.json(), { ok: false, code: scenario[2] });
  });
}
