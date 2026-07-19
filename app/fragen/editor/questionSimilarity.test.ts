import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateQuestionSimilarity,
  isPotentialQuestionDuplicate,
  normalizeQuestionForSimilarity,
} from "./questionSimilarity";

test("question similarity ignores casing, punctuation and umlaut spelling noise", () => {
  assert.equal(
    normalizeQuestionForSimilarity("  WELCHE Stadt ist größer? "),
    "welche stadt ist grosser",
  );
  assert.equal(
    isPotentialQuestionDuplicate(
      "Welche Stadt ist größer: Hamburg oder München?",
      "Welche Stadt ist groesser Hamburg oder Muenchen",
    ),
    true,
  );
});

test("question similarity keeps unrelated questions apart", () => {
  assert.ok(
    calculateQuestionSimilarity(
      "Wer schrieb den Roman Der Prozess?",
      "Wie hoch ist der Mount Everest?",
    ) < 0.3,
  );
});
