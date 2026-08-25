import assert from "node:assert/strict";
import test from "node:test";
import { getFunnyAnswerPage, getFunnyAnswerPageCount, type FunnyAnswerEntry } from "./funnyAnswerReveal";

const answers = Array.from({ length: 5 }, (_, index): FunnyAnswerEntry => ({
  teamAnswerId: index + 1,
  teamId: index + 1,
  teamName: `Team ${index + 1}`,
  answerText: `Antwort ${index + 1}`,
  avatarCode: "teekanne",
  photoUrl: null,
}));

test("one, two and three funny answers fit one page", () => {
  assert.equal(getFunnyAnswerPageCount(1), 1);
  assert.equal(getFunnyAnswerPageCount(2), 1);
  assert.equal(getFunnyAnswerPageCount(3), 1);
});

test("five funny answers remain reachable over two pages without truncation", () => {
  const first = getFunnyAnswerPage(answers, 1);
  const second = getFunnyAnswerPage(answers, 2);
  assert.deepEqual([...first.answers, ...second.answers].map((entry) => entry.teamAnswerId), [1, 2, 3, 4, 5]);
  assert.equal(second.pageCount, 2);
});
