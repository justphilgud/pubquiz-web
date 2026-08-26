import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PUBLIC_QUESTION_LIMITS,
  submitPublicQuestion,
  validatePublicQuestionSubmission,
  type PublicQuestionSubmissionInput,
  type PublicQuestionSubmissionRepository,
  type ValidPublicQuestionSubmission,
} from "./publicQuestionSubmission";
import { createPublicSubmissionFingerprint } from "./publicQuestionFingerprint";

const validInput: PublicQuestionSubmissionInput = {
  question: "Welcher Planet dreht sich am schnellsten um die eigene Achse?",
  answer: "Jupiter",
  explanation: "Ein Jupitertag dauert nur knapp zehn Stunden.",
  sourceUrl: "https://example.org/jupiter",
  submitterName: "Ada Beispiel",
  submitterEmail: "ADA@EXAMPLE.ORG",
  website: "",
};

function repository(options?: { rateLimitAccepted?: boolean }) {
  const created: ValidPublicQuestionSubmission[] = [];
  let rateLimitCalls = 0;
  const value: PublicQuestionSubmissionRepository = {
    async consumeRateLimit() {
      rateLimitCalls += 1;
      return options?.rateLimitAccepted ?? true;
    },
    async createPendingQuestion(input) {
      created.push(input);
      return 17;
    },
  };
  return { value, created, get rateLimitCalls() { return rateLimitCalls; } };
}

test("accepts an anonymous public question without inventing contact data", async () => {
  const target = repository();
  const result = await submitPublicQuestion(
    { ...validInput, submitterName: "", submitterEmail: "" },
    { fingerprint: "fingerprint", now: new Date("2026-08-26T10:00:00Z") },
    target.value,
  );
  assert.equal(result.status, "SUCCESS");
  assert.equal(target.created.length, 1);
  assert.equal(target.created[0].submitterName, "");
  assert.equal(target.created[0].submitterEmail, "");
});

test("keeps optional contact separate and normalizes the email", async () => {
  const target = repository();
  await submitPublicQuestion(
    validInput,
    { fingerprint: "fingerprint", now: new Date("2026-08-26T10:00:00Z") },
    target.value,
  );
  assert.equal(target.created[0].submitterName, "Ada Beispiel");
  assert.equal(target.created[0].submitterEmail, "ada@example.org");
});

test("rejects missing, malformed and oversized public payload fields", () => {
  const result = validatePublicQuestionSubmission({
    ...validInput,
    question: "",
    answer: "x".repeat(PUBLIC_QUESTION_LIMITS.answer + 1),
    sourceUrl: "javascript:alert(1)",
    submitterEmail: "not-an-email",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(Object.keys(result.fieldErrors).sort(), [
    "answer",
    "question",
    "sourceUrl",
    "submitterEmail",
  ]);
});

test("honeypot submissions return neutral success without rate or database writes", async () => {
  const target = repository();
  const result = await submitPublicQuestion(
    { ...validInput, website: "https://spam.example" },
    { fingerprint: "fingerprint", now: new Date("2026-08-26T10:00:00Z") },
    target.value,
  );
  assert.equal(result.status, "SUCCESS");
  assert.equal(target.rateLimitCalls, 0);
  assert.equal(target.created.length, 0);
});

test("rate limiting blocks the write with a controlled message", async () => {
  const target = repository({ rateLimitAccepted: false });
  const result = await submitPublicQuestion(
    validInput,
    { fingerprint: "fingerprint", now: new Date("2026-08-26T10:00:00Z") },
    target.value,
  );
  assert.equal(result.status, "ERROR");
  assert.match(result.message, /Stunde/);
  assert.equal(target.created.length, 0);
});

test("request fingerprints are stable, salted and never expose the address", () => {
  const first = createPublicSubmissionFingerprint({ clientAddress: "192.0.2.2", secret: "one" });
  const repeated = createPublicSubmissionFingerprint({ clientAddress: "192.0.2.2", secret: "one" });
  const otherSecret = createPublicSubmissionFingerprint({ clientAddress: "192.0.2.2", secret: "two" });
  assert.equal(first, repeated);
  assert.notEqual(first, otherSecret);
  assert.equal(first.length, 64);
  assert.doesNotMatch(first, /192\.0\.2\.2/);
});

test("public rendering relies on React escaping and never injects submitted HTML", () => {
  const form = readFileSync("app/frage-einreichen/PublicQuestionSubmissionForm.tsx", "utf8");
  const page = readFileSync("app/frage-einreichen/page.tsx", "utf8");
  assert.doesNotMatch(`${form}\n${page}`, /dangerouslySetInnerHTML/);
  const result = validatePublicQuestionSubmission({
    ...validInput,
    question: '<img src=x onerror="alert(1)">',
  });
  assert.equal(result.ok, true);
});

test("architecture stores a normal unapproved review question and separate contact", () => {
  const server = readFileSync("app/frage-einreichen/publicQuestionSubmission.server.ts", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const proxy = readFileSync("proxy.ts", "utf8");
  assert.match(server, /review_status: "IN_REVIEW"/);
  assert.match(server, /freigegeben: false/);
  assert.match(server, /created_by_user_id: null/);
  assert.match(server, /public_submission:/);
  assert.match(schema, /model public_question_submissions/);
  assert.match(schema, /model public_question_rate_limits/);
  assert.match(proxy, /"\/frage-einreichen"/);
});

test("migration is additive and preserves the question as the owning review record", () => {
  const migration = readFileSync(
    "prisma/migrations/20260826100000_add_public_question_submissions/migration.sql",
    "utf8",
  );
  assert.match(migration, /CREATE TABLE "pubquiz"\."public_question_submissions"/);
  assert.match(migration, /CREATE TABLE "pubquiz"\."public_question_rate_limits"/);
  assert.match(migration, /UNIQUE \("fragen_id"\)/);
  assert.match(migration, /REFERENCES "pubquiz"\."fragen"\("fragen_id"\)/);
  assert.match(migration, /ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE)\b/i);
});
