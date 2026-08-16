import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the pixel stop action follows the answer input in the participant UI", () => {
  const client = readFileSync(
    "app/quiz/[quizId]/antworten/QuizAntwortClient.tsx",
    "utf8",
  );
  const answerInput = client.indexOf("<GenericAnswerRenderer");
  const pixelStopAction = client.indexOf(
    "Verpixelung für alle stoppen & Antwort abgeben",
  );

  assert.notEqual(answerInput, -1);
  assert.notEqual(pixelStopAction, -1);
  assert.ok(answerInput < pixelStopAction);
});
