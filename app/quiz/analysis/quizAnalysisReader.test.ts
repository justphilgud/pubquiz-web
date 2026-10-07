import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Client } from "pg";
import { canonicalAnalysisTemplate, readQuizAnalysis } from "./quizAnalysisReader";

test("snapshot uses only a read-only transaction and editorial SELECTs, preserves stored order", async () => {
  const calls: string[] = [];
  const assignment = { id: 8, questionId: 2, sectionId: 4, position: 3, storedAnswerOrder: [9, 7, 2] };
  const before = structuredClone(assignment);
  const client = { async query(sql: string) {
    calls.push(sql);
    if (sql.includes("transaction_timestamp")) return { rows: [{ capturedAt: "2026-10-07", readOnly: "on" }] };
    if (sql.includes("FROM pubquiz.fragen q")) return { rows: [] };
    if (sql.includes("FROM pubquiz.quiz q")) return { rows: [{ value: { id: 1, assignments: [assignment] } }] };
    return { rows: [] };
  } } as unknown as Pick<Client, "query">;
  const snapshot = await readQuizAnalysis(client);
  assert.deepEqual(assignment, before);
  assert.deepEqual(snapshot.quizzes[0].assignments[0].storedAnswerOrder, [9, 7, 2]);
  assert.equal(calls[0], "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(calls.at(-1), "ROLLBACK");
  for (const sql of calls.slice(1, -1)) {
    assert.match(sql, /^SELECT /);
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|CALL|COMMIT)\b/i);
    assert.doesNotMatch(sql, /pubquiz\.(?:team_|users|teams|quiz_interaction|quiz_praesentation|quiz_block_freigaben)/);
  }
});

test("fails closed if database does not enforce read-only and always rolls back", async () => {
  const calls: string[] = [];
  const client = { async query(sql: string) {
    calls.push(sql);
    return { rows: [{ readOnly: "off" }] };
  } } as unknown as Pick<Client, "query">;
  await assert.rejects(readQuizAnalysis(client), /ANALYSIS_TRANSACTION_NOT_READ_ONLY/);
  assert.equal(calls.length, 3);
  assert.equal(calls.at(-1), "ROLLBACK");
});

test("rolls back failed content SELECT instead of initializing runtime or repairing", async () => {
  const calls: string[] = [];
  const client = { async query(sql: string) {
    calls.push(sql);
    if (sql.includes("transaction_timestamp")) return { rows: [{ readOnly: "on" }] };
    if (sql.startsWith("SELECT")) throw new Error("content read failed");
    return { rows: [] };
  } } as unknown as Pick<Client, "query">;
  await assert.rejects(readQuizAnalysis(client), /content read failed/);
  assert.equal(calls.at(-1), "ROLLBACK");
});

test("legacy aliases and dynamic base templates share canonical identities", () => {
  const template = { id: 1, code: "facemorph", name: "x", kind: "SYSTEM", status: "ACTIVE", active: true, baseCode: null };
  assert.equal(canonicalAnalysisTemplate(null), "standard");
  assert.equal(canonicalAnalysisTemplate(template), "face_morph");
  assert.equal(canonicalAnalysisTemplate({ ...template, code: "multiple-choice" }), "standard");
  assert.equal(canonicalAnalysisTemplate({ ...template, code: "user-template", baseCode: "music-reverse" }), "musik_rueckwaerts");
});

test("server boundary authorizes whole unpublished inventory before connecting", () => {
  const source = readFileSync(new URL("./quizAnalysis.server.ts", import.meta.url), "utf8");
  assert.ok(source.indexOf("await requireAdmin()") < source.indexOf("new Pool"));
  assert.match(source, /import "server-only"/);
  assert.doesNotMatch(source, /repair|ensureQuiz|team_antworten|interaction\.server/);
});

test("projection keeps unpublished solutions, answer-field media, null positions and original aliases", async () => {
  const template = { id: 1, code: "multiple-choice", name: "Alt", kind: "SYSTEM", status: "ACTIVE", active: true, baseCode: null };
  const question = { id: 2, text: "Welche Antwort?", reviewStatus: "DRAFT", template, templateConfig: null,
    answers: [{ id: 1, text: "Richtig", correct: true, explanation: null }],
    answerFields: [{ id: 4, label: "Person", position: 1, solutions: [{ text: "Ada", accepted: true, position: 1 }] }],
    media: [{ id: 5, owner: "ANSWER_FIELD", answerFieldId: 4, slot: "answer_image" }] };
  const before = structuredClone(question);
  const client = { async query(sql: string) {
    if (sql.includes("transaction_timestamp")) return { rows: [{ capturedAt: "2026-10-07", readOnly: "on" }] };
    if (sql.includes("FROM pubquiz.fragen q")) return { rows: [{ value: question }] };
    if (sql.includes("FROM pubquiz.quiz q")) return { rows: [{ value: { id: 3, title: "Test", archived: false, eventSeriesId: 7,
      assignments: [{ id: 8, questionId: 2, sectionId: null, position: null, storedAnswerOrder: [1] }] } }] };
    return { rows: [] };
  } } as unknown as Pick<Client, "query">;
  const snapshot = await readQuizAnalysis(client);
  assert.deepEqual(snapshot.questions[0].solutions, ["Richtig", "Person: Ada"]);
  assert.equal(snapshot.questions[0].canonicalTemplate, "standard");
  assert.equal(snapshot.questions[0].template?.code, "multiple-choice");
  assert.equal(snapshot.questions[0].reviewStatus, "DRAFT");
  assert.equal(snapshot.questions[0].quizUsages[0].position, null);
  assert.deepEqual(question, before);
});
