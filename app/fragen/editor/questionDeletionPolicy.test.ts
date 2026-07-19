import assert from "node:assert/strict";
import test from "node:test";
import { getQuestionDeletionBlocker } from "./questionDeletionPolicy";

const emptyCounts = {
  quizAssignments: 0,
  teamAnswers: 0,
  relations: 0,
  media: 0,
  generatorRuns: 0,
};

test("blocks permanent deletion when a question is already in use", () => {
  assert.equal(
    getQuestionDeletionBlocker({ ...emptyCounts, quizAssignments: 1 }),
    "QUESTION_IN_USE",
  );
  assert.equal(
    getQuestionDeletionBlocker({ ...emptyCounts, teamAnswers: 1 }),
    "QUESTION_IN_USE",
  );
});

test("blocks deletion of related or media-backed questions", () => {
  assert.equal(
    getQuestionDeletionBlocker({ ...emptyCounts, relations: 1 }),
    "QUESTION_HAS_RELATIONS",
  );
  assert.equal(
    getQuestionDeletionBlocker({ ...emptyCounts, media: 1 }),
    "QUESTION_HAS_MEDIA",
  );
  assert.equal(
    getQuestionDeletionBlocker({ ...emptyCounts, generatorRuns: 1 }),
    "QUESTION_HAS_MEDIA",
  );
});

test("allows deletion only when no protected references remain", () => {
  assert.equal(getQuestionDeletionBlocker(emptyCounts), null);
});
