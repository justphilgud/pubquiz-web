import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { questionRewriteResponse } from "@/app/fragen/editor/questionRewriteEndpoint";
import { isQuestionRewriteEnabled } from "@/app/fragen/editor/questionRewriteFeature.server";
import { createOpenAIQuestionRewriteProvider } from "@/app/fragen/editor/questionRewriteProvider.server";
import { loadLocalEnvironment } from "../load-local-environment";

const INPUT_USD_PER_MILLION_TOKENS = 0.2;
const OUTPUT_USD_PER_MILLION_TOKENS = 1.2;
const TEST_BUDGET_USD = 1;
const MAX_ESTIMATED_INPUT_TOKENS_PER_REQUEST = 1_000;
const MAX_OUTPUT_TOKENS_PER_REQUEST = 220;

const questions = [
  { id: "short", text: "Wer war Mozart?" },
  { id: "long", text: "Welche Stadt ist es, die als Hauptstadt von Frankreich gilt und zugleich an dem Fluss Seine gelegen ist?" },
  { id: "awkward", text: "Wie heißt denn eigentlich das Land, wo die Hauptstadt davon Ottawa ist?" },
  { id: "already-good", text: "Wie heißt die Hauptstadt von Japan?" },
  { id: "year", text: "In welchem Jahr fiel die Berliner Mauer?" },
  { id: "numbers", text: "Wie viele Minuten dauern 2 Stunden und 30 Minuten?" },
  { id: "person", text: "Welches Werk schrieb Johann Wolfgang von Goethe?" },
  { id: "names", text: "In welcher Stadt trafen sich John Lennon und Paul McCartney erstmals?" },
  { id: "place", text: "Durch welche Stadt fließt die Seine?" },
  { id: "foreign-name", text: "Welches Unternehmen gründete Ingvar Kamprad?" },
  { id: "quote", text: "Wer sagte „Ich denke, also bin ich“?" },
  { id: "parentheses", text: "Welcher Planet ist der Sonne am nächsten (benannt nach einem römischen Gott)?" },
  { id: "additional", text: "Welche Insel ist die größte der Erde, wenn Australien als Kontinent gezählt wird?" },
  { id: "term", text: "Wie heißt der Prozess, bei dem Pflanzen Lichtenergie in chemische Energie umwandeln?" },
  { id: "wordplay", text: "Welches Tier steckt im Wort Katerstimmung?" },
  { id: "answer-leak", text: "Welche rote Frucht, die oft für Ketchup verwendet wird, gehört botanisch zu den Beeren?" },
  { id: "difficulty", text: "Welches chemische Element trägt das Symbol W?" },
  { id: "minimal-change", text: "Wer malte die Mona Lisa?" },
  { id: "complex", text: "Wie heißt der Roman, den George Orwell im Jahr 1949 veröffentlichte und dessen Titel aus einer umgestellten Jahreszahl besteht?" },
  { id: "sensitive-facts", text: "Welcher Physiker formulierte 1905 die spezielle Relativitätstheorie und erhielt 1921 den Nobelpreis für Physik?" },
] as const;

const actor: AuthorizationActor = {
  userId: -1,
  assignments: [{
    role: "EDITOR",
    scopeType: "GLOBAL",
    eventSeriesId: null,
  }],
};

const outputArgument = process.argv.find((argument) =>
  argument.startsWith("--output=")
);
const outputPath = resolve(
  process.cwd(),
  outputArgument?.slice("--output=".length) ??
    "docs/reports/openai-question-rewrite-live-results.json",
);

async function main() {
  loadLocalEnvironment({ required: true });

  if (!isQuestionRewriteEnabled()) {
    throw new Error("OPENAI_QUESTION_REWRITE_ENABLED ist nicht aktiv.");
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY fehlt.");
  }

  const maximumEstimatedCost =
    questions.length *
    (
      MAX_ESTIMATED_INPUT_TOKENS_PER_REQUEST * INPUT_USD_PER_MILLION_TOKENS +
      MAX_OUTPUT_TOKENS_PER_REQUEST * OUTPUT_USD_PER_MILLION_TOKENS
    ) /
    1_000_000;
  if (maximumEstimatedCost >= TEST_BUDGET_USD) {
    throw new Error("Der konservative Kostenvoranschlag überschreitet das Testbudget.");
  }

  const provider = createOpenAIQuestionRewriteProvider({
    ...process.env,
    OPENAI_INPUT_USD_PER_MILLION_TOKENS: String(INPUT_USD_PER_MILLION_TOKENS),
    OPENAI_OUTPUT_USD_PER_MILLION_TOKENS: String(OUTPUT_USD_PER_MILLION_TOKENS),
  });

  const results: Array<Record<string, unknown>> = [];
  let accumulatedCostUsd = 0;

  for (const question of questions) {
    if (accumulatedCostUsd >= TEST_BUDGET_USD) {
      throw new Error("Das Kostenlimit ist erreicht; weitere Aufrufe wurden gestoppt.");
    }
    const startedAt = performance.now();
    const response = await questionRewriteResponse(
    new Request("http://localhost/api/question-rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionText: question.text }),
    }),
    {
      enabled: () => true,
      actor: async () => actor,
      provider: () => provider,
      rateLimit: { acquire: () => true },
    },
  );
    const body = await response.json() as Record<string, unknown>;
    const latencyMs = Math.round(performance.now() - startedAt);
    if (body.ok === true) {
      const cost = body.cost as { amountUsd?: unknown } | null;
      if (typeof cost?.amountUsd === "number") {
        accumulatedCostUsd += cost.amountUsd;
      }
    }
    results.push({
      id: question.id,
      original: question.text,
      httpStatus: response.status,
      latencyMs,
      ...body,
    });
    console.log(`${question.id}: HTTP ${response.status}, ${latencyMs} ms`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    model: process.env.OPENAI_QUESTION_REWRITE_MODEL ?? "gpt-5.6-luna",
    pricingUsdPerMillionTokens: {
      input: INPUT_USD_PER_MILLION_TOKENS,
      output: OUTPUT_USD_PER_MILLION_TOKENS,
    },
    budgetUsd: TEST_BUDGET_USD,
    maximumEstimatedCostUsd: maximumEstimatedCost,
    actualCostUsd: accumulatedCostUsd,
    results,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "w",
  });
  console.log(`Resultate: ${outputPath}`);
}

void main();
