import assert from "node:assert/strict";
import test from "node:test";

import { sortQuizQuestionAssignments } from "./quizQuestionOrder";

test("explicit question positions sort before legacy null positions", () => {
  assert.deepEqual(
    sortQuizQuestionAssignments([
      { quiz_fragen_id: 30, sortierung: null },
      { quiz_fragen_id: 20, sortierung: 2 },
      { quiz_fragen_id: 10, sortierung: 1 },
    ]).map((question) => question.quiz_fragen_id),
    [10, 20, 30],
  );
});

test("equal and missing positions use the stable assignment identity", () => {
  assert.deepEqual(
    sortQuizQuestionAssignments([
      { quiz_fragen_id: 42, sortierung: null },
      { quiz_fragen_id: 12, sortierung: 7 },
      { quiz_fragen_id: 11, sortierung: 7 },
      { quiz_fragen_id: 41, sortierung: null },
    ]).map((question) => question.quiz_fragen_id),
    [11, 12, 41, 42],
  );
});
