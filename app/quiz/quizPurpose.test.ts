import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { matchesQuizFilters, resolveQuizPurpose, resolveQuizPurposeFilter, updateQuizFilterUrl } from "./quizPurpose";

const regular = { purpose: "REGULAR" as const, eventreihe_id: 6, temporal_status: "PAST", titel: "Acceptance", eventreihe_name: "Demo" };
const technical = { ...regular, purpose: "TEST" as const };
const filters = { purpose: "REGULAR" as const, eventSeries: "", status: "", query: "" };

test("purpose is explicit, defaults regular, and never guesses from names", () => {
  assert.equal(resolveQuizPurpose(undefined), "REGULAR");
  assert.equal(resolveQuizPurpose("TEST"), "TEST");
  assert.throws(() => resolveQuizPurpose("smoke"));
  assert.equal(matchesQuizFilters(regular, filters), true);
});
test("all three purpose filters and safe URL fallback", () => {
  for (const value of [null, "", "invalid", "test", "REGULAR"]) assert.equal(resolveQuizPurposeFilter(value), "REGULAR");
  assert.deepEqual([regular, technical].filter(q => matchesQuizFilters(q, filters)), [regular]);
  assert.deepEqual([regular, technical].filter(q => matchesQuizFilters(q, { ...filters, purpose: "TEST" })), [technical]);
  assert.equal([regular, technical].filter(q => matchesQuizFilters(q, { ...filters, purpose: "ALL" })).length, 2);
});
test("purpose, event series, status and search intersect", () => {
  const combined = { purpose: "TEST" as const, eventSeries: "6", status: "PAST", query: "ACCEPTANCE" };
  assert.equal(matchesQuizFilters(technical, combined), true);
  for (const changed of [{ eventSeries: "7" }, { status: "TODAY" }, { query: "missing" }, { purpose: "REGULAR" as const }]) assert.equal(matchesQuizFilters(technical, { ...combined, ...changed }), false);
});
test("URL changes preserve every other filter and unrelated parameters", () => {
  let url = "tab=verwaltung&editQuizId=23&eventSeries=6&status=PAST&q=Acceptance";
  url = updateQuizFilterUrl(url, "purpose", "TEST");
  const reload = new URLSearchParams(url);
  assert.equal(resolveQuizPurposeFilter(reload.get("purpose")), "TEST");
  for (const [key, value] of new URLSearchParams("tab=verwaltung&editQuizId=23&eventSeries=6&status=PAST&q=Acceptance")) assert.equal(reload.get(key), value);
  assert.equal(new URLSearchParams(updateQuizFilterUrl(url, "q", "")).has("q"), false);
});
test("additive migration initializes historical rows REGULAR without reclassification", () => {
  const sql = readFileSync("prisma/migrations/20261006120000_add_quiz_purpose/migration.sql", "utf8");
  assert.match(sql, /ADD COLUMN "purpose".*NOT NULL DEFAULT 'REGULAR'/);
  assert.doesNotMatch(sql, /UPDATE|DELETE|DROP/i);
});
for (const purpose of [undefined, "REGULAR", "TEST"] as const) test(`createQuiz writes ${purpose ?? "default REGULAR"} through unchanged access checks`, async () => {
  const actions = readFileSync("app/quiz/actions.ts", "utf8");
  const source = actions.slice(actions.indexOf("export async function createQuiz("), actions.indexOf("export async function updateQuiz("));
  let stored: Record<string, unknown> | undefined;
  let authorized = false;
  const exports: { createQuiz?: (data: Record<string, unknown>) => Promise<unknown> } = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, resolveQuizPurpose, isQuizSolutionStrategy: () => true, DEFAULT_NEW_QUIZ_SOLUTION_STRATEGY: "END_OF_BLOCK",
    getPresentationTemplateValidationOptions: async () => ({}),
    validateQuizMasterData: () => ({ ok: true, value: { eventSeriesId: 6, title: "Acceptance" } }),
    requireEventSeriesAccess: async (id: number, capability: string) => { assert.equal(id, 6); assert.equal(capability, "MANAGE_QUIZZES"); authorized = true; },
    getEventSeriesForQuizSave: async () => ({ ok: true }),
    prisma: { quiz: { create: async ({ data }: { data: Record<string, unknown> }) => { assert.equal(authorized, true); stored = data; return { quiz_id: 100 }; } } },
    createDefaultQuizAbschnitte: async () => {}, revalidatePath: () => {},
  });
  await exports.createQuiz!({ purpose });
  assert.equal(stored?.purpose, purpose ?? "REGULAR");
});
test("purpose never becomes a route-access or permission condition", () => {
  const access = readFileSync("app/quiz/quizAccess.server.ts", "utf8");
  assert.doesNotMatch(access, /purpose/);
  assert.match(access, /requireEventSeriesAccess/);
  const form = readFileSync("app/quiz/QuizForm.tsx", "utf8");
  assert.match(form, /window.history.replaceState/);
  assert.doesNotMatch(form, /updateField\("purpose"/);
});
