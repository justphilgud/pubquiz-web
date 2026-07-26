import assert from "node:assert/strict";
import test from "node:test";
import {
  getAnswerContentFingerprint,
  hasAnswerContentChanged,
} from "./answerContent";

const empty = {
  answerText: null,
  selectedAnswerIds: [],
  structuredAnswers: [],
};

test("identical normalized answer content keeps a manual override", () => {
  assert.equal(
    hasAnswerContentChanged(
      {
        answerText: "  Die   Antwort ",
        selectedAnswerIds: [3, 1, 3],
        structuredAnswers: [{ fieldId: 2, answerText: " Berlin " }],
      },
      {
        answerText: "die antwort",
        selectedAnswerIds: [1, 3],
        structuredAnswers: [{ fieldId: 2, answerText: "berlin" }],
      },
    ),
    false,
  );
});

test("multiple-choice selection changes are detected", () => {
  assert.equal(
    hasAnswerContentChanged(
      { ...empty, selectedAnswerIds: [1, 2] },
      { ...empty, selectedAnswerIds: [1, 3] },
    ),
    true,
  );
});

test("structured answer changes are detected independent of field order", () => {
  const previous = {
    ...empty,
    structuredAnswers: [
      { fieldId: 2, answerText: "B" },
      { fieldId: 1, answerText: "A" },
    ],
  };
  assert.equal(
    getAnswerContentFingerprint(previous),
    getAnswerContentFingerprint({
      ...empty,
      structuredAnswers: [
        { fieldId: 1, answerText: "a" },
        { fieldId: 2, answerText: "b" },
      ],
    }),
  );
  assert.equal(
    hasAnswerContentChanged(previous, {
      ...empty,
      structuredAnswers: [
        { fieldId: 1, answerText: "A" },
        { fieldId: 2, answerText: "C" },
      ],
    }),
    true,
  );
});

test("ordering changes remain order-sensitive", () => {
  assert.equal(
    hasAnswerContentChanged(
      { ...empty, answerText: '["first","second"]' },
      { ...empty, answerText: '["second","first"]' },
    ),
    true,
  );
});
