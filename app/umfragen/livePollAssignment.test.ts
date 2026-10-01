import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isExpectedLivePollPlacement } from "./livePollAssignment";

test("poll placement readback requires quiz, poll and placement identity", () => {
  const expected = { quizId: 72, pollId: 2, placementId: 300 };
  assert.equal(isExpectedLivePollPlacement(expected, expected), true);
  assert.equal(isExpectedLivePollPlacement(expected, null), false);
  assert.equal(isExpectedLivePollPlacement(expected, { ...expected, quizId: 73 }), false);
  assert.equal(isExpectedLivePollPlacement(expected, { ...expected, pollId: 3 }), false);
  assert.equal(isExpectedLivePollPlacement(expected, { ...expected, placementId: 301 }), false);
});

test("poll assignment is serialized, idempotent and confirmed before success", () => {
  const action = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const quizEditor = readFileSync(new URL("../quiz/[quizId]/QuizFragenHinzufuegen.tsx", import.meta.url), "utf8");
  const quizTable = readFileSync(new URL("../quiz/[quizId]/QuizFragenSortableTable.tsx", import.meta.url), "utf8");

  assert.match(action, /prisma\.\$transaction/);
  assert.match(action, /pg_advisory_xact_lock/);
  assert.match(action, /alreadyAssigned: true/);
  assert.match(action, /isExpectedLivePollPlacement/);
  assert.match(quizEditor, /newlyAssignedPollIds/);
  assert.match(quizEditor, /setNewlyAssignedPollIds/);
  assert.match(quizTable, /useState<QuizStandalonePoll\[]>\(standalonePolls\)/);
  const quizPage = readFileSync(new URL("../quiz/[quizId]/page.tsx", import.meta.url), "utf8");
  assert.match(quizPage, /quiz\.standalonePolls\.map/);
  assert.match(quizPage, /`p\$\{poll\.placementId\}/);
});
