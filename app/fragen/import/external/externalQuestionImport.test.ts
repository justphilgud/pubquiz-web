import assert from "node:assert/strict";
import test from "node:test";
import { findDuplicateCandidates } from "./duplicates";
import {
  validateGatewayAutomationResponse,
  VercelAiGatewayQuestionAutomationAdapter,
} from "./automation";
import {
  decodeHtmlEntities,
  decodeOpenTdbText,
  normalizeOpenTdbQuestion,
  validateExternalQuestionEnrichment,
} from "./normalize";
import { OpenTdbProvider } from "./opentdbProvider";
import { prepareExternalQuestion } from "./pipeline";
import { canWriteOpenTdbPilot } from "./policy";
import {
  evaluateExternalQuestionQuality,
  mapOpenTdbCategory,
  mapOpenTdbDifficulty,
} from "./quality";
import type { OpenTdbApiQuestion } from "./types";

function rawQuestion(question = "What%20is%202%20%26%202%3F"): OpenTdbApiQuestion {
  return {
    type: "multiple",
    difficulty: "easy",
    category: "General%20Knowledge",
    question,
    correct_answer: "4",
    incorrect_answers: ["2", "3", "5"],
  };
}

test("OpenTDB text decoding handles URL and HTML encodings without a dependency", () => {
  assert.equal(decodeOpenTdbText("Tom%20%26amp%3B%20Jerry"), "Tom & Jerry");
  assert.equal(decodeHtmlEntities("&#039;Hi&#x21; &quot;ok&quot;"), "'Hi! \"ok\"");
});

test("normalization creates a stable provider reference and keeps provenance", () => {
  const first = normalizeOpenTdbQuestion(rawQuestion());
  const second = normalizeOpenTdbQuestion(rawQuestion());
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.externalReference, second.externalReference);
  assert.match(first.externalReference, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.question, "What is 2 & 2?");
  assert.equal(first.license, "CC BY-SA 4.0");
});

test("unsupported OpenTDB records do not enter the multiple-choice pilot", () => {
  assert.equal(normalizeOpenTdbQuestion({ ...rawQuestion(), type: "boolean" }), null);
  assert.equal(normalizeOpenTdbQuestion({ ...rawQuestion(), difficulty: "unknown" }), null);
});

test("structured enrichment validates completeness and HTTPS sources", () => {
  const valid = validateExternalQuestionEnrichment({
    question: "Wie viel ist zwei plus zwei?",
    correctAnswer: "4",
    incorrectAnswers: ["2", "3", "5"],
    explanation: "Zwei plus zwei ergibt vier.",
    verificationSourceUrl: "https://example.org/source",
    verificationSourceTitle: "Fachquelle",
    suggestedCategoryName: "Allgemeinwissen",
  });
  assert.ok(valid);
  assert.equal(valid.question, "Wie viel ist zwei plus zwei?");
  assert.equal(validateExternalQuestionEnrichment({ ...valid, incorrectAnswers: ["2"] }), null);
  assert.equal(validateExternalQuestionEnrichment({ ...valid, verificationSourceUrl: "http://example.org" }), null);
});

test("untranslated or unverified records remain in review", () => {
  const question = normalizeOpenTdbQuestion(rawQuestion());
  assert.ok(question);
  const result = evaluateExternalQuestionQuality({ question, enrichment: null });
  assert.equal(result.autoRejected, false);
  assert.ok(result.issues.includes("MISSING_TRANSLATION"));
  assert.ok(result.issues.includes("MISSING_FACT_SOURCE"));
  assert.equal(result.suggestedCategoryName, "Allgemeinwissen");
  assert.equal(result.mappedDifficulty, 25);
});

test("structurally duplicated answers are automatically rejected", () => {
  const question = normalizeOpenTdbQuestion({ ...rawQuestion(), incorrect_answers: ["4", "3", "5"] });
  assert.ok(question);
  const result = evaluateExternalQuestionQuality({ question, enrichment: null });
  assert.equal(result.autoRejected, true);
  assert.ok(result.issues.includes("DUPLICATE_ANSWER"));
});

test("difficulty and category mapping are deterministic", () => {
  assert.equal(mapOpenTdbDifficulty("easy"), 25);
  assert.equal(mapOpenTdbDifficulty("medium"), 50);
  assert.equal(mapOpenTdbDifficulty("hard"), 75);
  assert.equal(mapOpenTdbCategory("Geography"), "Geografie");
  assert.equal(mapOpenTdbCategory("Unknown"), "");
});

test("exact duplicates are blocked and exposed in review", () => {
  const exact = findDuplicateCandidates("Was ist die Hauptstadt Australiens?", [
    { questionId: 1, question: "Was ist die Hauptstadt Australiens?" },
  ]);
  assert.deepEqual(exact.map(({ questionId, kind }) => [questionId, kind]), [[1, "EXACT"]]);
  const question = normalizeOpenTdbQuestion(rawQuestion("What%20is%20the%20capital%20of%20Australia%3F"));
  assert.ok(question);
  const prepared = prepareExternalQuestion({
    question,
    enrichment: {
      question: "Was ist die Hauptstadt Australiens?",
      correctAnswer: "Canberra",
      incorrectAnswers: ["Sydney", "Melbourne", "Perth"],
      explanation: null,
      verificationSourceUrl: "https://www.australia.gov.au/about-australia/cities",
      verificationSourceTitle: "Australian Government",
      suggestedCategoryName: "Geografie",
    },
    existingQuestions: [{ questionId: 1, question: "Was ist die Hauptstadt Australiens?" }],
  });
  assert.equal(prepared.autoRejected, true);
  assert.ok(prepared.issues.includes("POTENTIAL_EXACT_DUPLICATE"));
});

test("provider requests exactly 100 mixed-difficulty multiple-choice questions", async () => {
  const calls: URL[] = [];
  const mockFetch: typeof fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    calls.push(url);
    if (url.pathname.endsWith("api_token.php")) return Response.json({ response_code: 0, token: "pilot-token" });
    const amount = Number(url.searchParams.get("amount"));
    const difficulty = url.searchParams.get("difficulty")!;
    const offset = calls.length * 1000;
    return Response.json({
      response_code: 0,
      results: Array.from({ length: amount }, (_, index) => ({
        ...rawQuestion(`Question%20${offset + index}%3F`),
        difficulty,
      })),
    });
  };
  const result = await new OpenTdbProvider(mockFetch).fetchQuestions({ count: 100 });
  assert.equal(result.length, 100);
  assert.deepEqual(calls.slice(1).map((url) => [
    url.searchParams.get("difficulty"),
    url.searchParams.get("amount"),
    url.searchParams.get("type"),
    url.searchParams.get("encode"),
  ]), [
    ["easy", "34", "multiple", "url3986"],
    ["medium", "33", "multiple", "url3986"],
    ["hard", "33", "multiple", "url3986"],
  ]);
});

test("provider rejects duplicate responses instead of silently underfilling", async () => {
  const mockFetch: typeof fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.pathname.endsWith("api_token.php")) return Response.json({ response_code: 0, token: "pilot-token" });
    const amount = Number(url.searchParams.get("amount"));
    return Response.json({
      response_code: 0,
      results: Array.from({ length: amount }, () => rawQuestion("Same%20question%3F")),
    });
  };
  await assert.rejects(
    () => new OpenTdbProvider(mockFetch).fetchQuestions({ count: 100 }),
    /OPENTDB_UNIQUE_COUNT_MISMATCH/,
  );
});

test("provider replaces an excluded prior import instead of poisoning a retry batch", async () => {
  const excluded = normalizeOpenTdbQuestion(rawQuestion("Already%20imported%3F"));
  assert.ok(excluded);
  let apiCalls = 0;
  const mockFetch: typeof fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.pathname.endsWith("api_token.php")) {
      return Response.json({ response_code: 0, token: "pilot-token" });
    }
    apiCalls += 1;
    return Response.json({
      response_code: 0,
      results: [rawQuestion(apiCalls === 1 ? "Already%20imported%3F" : "Fresh%20question%3F")],
    });
  };
  const result = await new OpenTdbProvider(mockFetch).fetchQuestions({
    count: 1,
    excludeExternalReferences: [excluded.externalReference],
  });
  assert.equal(apiCalls, 2);
  assert.equal(result[0]?.question, "Fresh question?");
});

test("provider retries a rate-limited request without weakening validation", async () => {
  let calls = 0;
  const waits: number[] = [];
  const mockFetch: typeof fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    calls += 1;
    if (calls === 1) return new Response(null, { status: 429, headers: { "retry-after": "1" } });
    if (url.pathname.endsWith("api_token.php")) return Response.json({ response_code: 0, token: "pilot-token" });
    const amount = Number(url.searchParams.get("amount"));
    return Response.json({
      response_code: 0,
      results: Array.from({ length: amount }, (_, index) => rawQuestion(`Retry%20${calls}%20${index}%3F`)),
    });
  };
  const result = await new OpenTdbProvider(
    mockFetch,
    async (milliseconds) => { waits.push(milliseconds); },
    0,
  ).fetchQuestions({ count: 3 });
  assert.equal(result.length, 3);
  assert.deepEqual(waits, [1000]);
});

test("pilot writes are allowed in Preview and denied in Production", () => {
  assert.equal(canWriteOpenTdbPilot({ environment: "preview", allowLocal: false }), true);
  assert.equal(canWriteOpenTdbPilot({ environment: "production", allowLocal: true }), false);
  assert.equal(canWriteOpenTdbPilot({ environment: "development", allowLocal: false }), false);
  assert.equal(canWriteOpenTdbPilot({ environment: "development", allowLocal: true }), true);
});

function gatewayPayload(overrides: Record<string, unknown> = {}) {
  return {
    localizedQuestion: "Wie viel ist zwei plus zwei?",
    localizedCorrectAnswer: "4",
    localizedIncorrectAnswers: ["2", "3", "5"],
    explanation: "Zwei plus zwei ergibt vier.",
    suggestedCategoryName: "Allgemeinwissen",
    localizationStatus: "LOCALIZED",
    localizationNote: "Natürlich ins Deutsche übertragen.",
    verificationStatus: "VERIFIED",
    verificationNote: "Die Quelle bestätigt das Ergebnis.",
    sourceUrls: ["https://example.edu/mathematics/addition"],
    flags: {
      ambiguous: false,
      languageDependent: false,
      localContext: false,
      poorDistractor: false,
      sourceQualityLow: false,
      timeSensitive: false,
    },
    changes: ["Frage und Antworten lokalisiert"],
    qualityNotes: [],
    rejectRecommended: false,
    rejectionReason: "",
    ...overrides,
  };
}

test("gateway enrichment accepts only provider-cited HTTPS sources", () => {
  const result = validateGatewayAutomationResponse({
    choices: [{ message: { content: JSON.stringify(gatewayPayload()) } }],
    search_results: [{
      title: "University Mathematics",
      url: "https://example.edu/mathematics/addition",
    }],
    citations: ["https://example.edu/mathematics/addition"],
  }, ["Allgemeinwissen"]);
  assert.equal(result.verificationStatus, "VERIFIED");
  assert.deepEqual(result.verificationSources, [{
    title: "University Mathematics",
    url: "https://example.edu/mathematics/addition",
  }]);
  assert.equal(result.enrichment.suggestedCategoryName, "Allgemeinwissen");
});

test("uncited or low-quality-only claims cannot become VERIFIED", () => {
  const uncited = validateGatewayAutomationResponse({
    choices: [{ message: { content: JSON.stringify(gatewayPayload({
      sourceUrls: ["https://invented.example/fact"],
    })) } }],
    citations: ["https://en.wikipedia.org/wiki/Addition"],
  }, ["Allgemeinwissen"]);
  assert.equal(uncited.verificationStatus, "NO_RELIABLE_SOURCE");
  assert.deepEqual(uncited.verificationSources, []);

  const wikipediaOnly = validateGatewayAutomationResponse({
    choices: [{ message: { content: JSON.stringify(gatewayPayload({
      sourceUrls: ["https://en.wikipedia.org/wiki/Addition"],
    })) } }],
    citations: ["https://en.wikipedia.org/wiki/Addition"],
  }, ["Allgemeinwissen"]);
  assert.equal(wikipediaOnly.verificationStatus, "NO_RELIABLE_SOURCE");
  assert.equal(wikipediaOnly.flags.sourceQualityLow, true);
});

test("phase-two quality gate produces reproducible review statuses", () => {
  const question = normalizeOpenTdbQuestion(rawQuestion());
  assert.ok(question);
  const ready = prepareExternalQuestion({
    question,
    automation: validateGatewayAutomationResponse({
      choices: [{ message: { content: JSON.stringify(gatewayPayload()) } }],
      citations: ["https://example.edu/mathematics/addition"],
    }, ["Allgemeinwissen"]),
  });
  assert.equal(ready.qualityStatus, "READY_FOR_REVIEW");

  const timeSensitive = prepareExternalQuestion({
    question,
    automation: validateGatewayAutomationResponse({
      choices: [{ message: { content: JSON.stringify(gatewayPayload({
        flags: { ...gatewayPayload().flags, timeSensitive: true },
      })) } }],
      citations: ["https://example.edu/mathematics/addition"],
    }, ["Allgemeinwissen"]),
  });
  assert.equal(timeSensitive.qualityStatus, "REVIEW_REQUIRED");
  assert.ok(timeSensitive.issues.includes("TIME_SENSITIVE"));

  const contradicted = prepareExternalQuestion({
    question,
    automation: validateGatewayAutomationResponse({
      choices: [{ message: { content: JSON.stringify(gatewayPayload({
        verificationStatus: "CONTRADICTED",
        rejectRecommended: true,
        rejectionReason: "Die Ausgangsantwort ist falsch.",
      })) } }],
      citations: ["https://example.edu/mathematics/addition"],
    }, ["Allgemeinwissen"]),
  });
  assert.equal(contradicted.qualityStatus, "REJECT_RECOMMENDED");
  assert.ok(contradicted.issues.includes("FACT_CONTRADICTED"));
});

test("gateway adapter uses the short-lived Vercel runtime OIDC header without exposing it", async () => {
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  try {
    const adapter = new VercelAiGatewayQuestionAutomationAdapter(async (_input, init) => {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-oidc-token");
      return Response.json({
        choices: [{ message: { content: JSON.stringify(gatewayPayload()) } }],
        citations: ["https://example.edu/mathematics/addition"],
      });
    }, "test-oidc-token");
    const question = normalizeOpenTdbQuestion(rawQuestion());
    assert.ok(question);
    const result = await adapter.process({
      question,
      availableCategories: ["Allgemeinwissen"],
    });
    assert.equal(result.verificationStatus, "VERIFIED");
  } finally {
    if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
  }
});
