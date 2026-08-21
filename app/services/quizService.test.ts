import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the quiz service persists the shared answer-ID ordering contract", () => {
  const service = readFileSync("app/services/quizService.ts", "utf8");

  assert.match(service, /resolveQuizSpecificOrderingAnswerIdOrder/);
  assert.match(
    service,
    /frage\.antworten\.map\(\(answer\) => answer\.antwort_id\)/,
  );
  assert.match(service, /antwort_reihenfolge: answerOrder/);
  assert.doesNotMatch(service, /resolveQuizSpecificOrderingItemOrder/);
});
