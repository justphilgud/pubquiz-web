import assert from "node:assert/strict";
import test from "node:test";
import { mergeQuizEditorSequenceIntoSlot } from "./quizEditorSequencePersistence";

test("reorders editor elements while preserving non-editor flow slots", () => {
  const result = mergeQuizEditorSequenceIntoSlot(
    [
      { id: 11, editorKey: "question-1" },
      { id: 12, editorKey: null },
      { id: 13, editorKey: "question-2" },
      { id: 14, editorKey: "poll-14" },
      { id: 15, editorKey: null },
    ],
    ["question-2", "poll-14", "question-1"],
  );

  assert.deepEqual(result, [13, 12, 14, 11, 15]);
  assert.equal(new Set(result).size, 5);
});

test("rejects incomplete, duplicate, and unknown editor sequences", () => {
  const placements = [
    { id: 11, editorKey: "question-1" },
    { id: 12, editorKey: null },
    { id: 13, editorKey: "poll-13" },
  ];

  assert.equal(
    mergeQuizEditorSequenceIntoSlot(placements, ["question-1"]),
    null,
  );
  assert.equal(
    mergeQuizEditorSequenceIntoSlot(placements, ["question-1", "question-1"]),
    null,
  );
  assert.equal(
    mergeQuizEditorSequenceIntoSlot(placements, ["question-1", "poll-99"]),
    null,
  );
  assert.equal(
    mergeQuizEditorSequenceIntoSlot(
      [
        { id: 11, editorKey: "question-1" },
        { id: 12, editorKey: "question-1" },
      ],
      ["question-1"],
    ),
    null,
  );
});
