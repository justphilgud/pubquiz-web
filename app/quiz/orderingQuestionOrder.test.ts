import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyQuizSpecificOrderingItemOrder,
  createQuizSpecificOrderingItemOrder,
} from "./orderingQuestionOrder";

const items = [
  { id: "cat", text: "Katze" },
  { id: "mouse", text: "Maus" },
  { id: "human", text: "Mensch" },
  { id: "dog", text: "Hund" },
];

test("a stored quiz-specific ordering is stable for every consumer", () => {
  const storedOrder = [2, 3, 0, 1];
  const firstRead = applyQuizSpecificOrderingItemOrder(items, storedOrder);
  const reload = applyQuizSpecificOrderingItemOrder(items, storedOrder);

  assert.deepEqual(firstRead.map((item) => item.id), ["human", "dog", "cat", "mouse"]);
  assert.deepEqual(reload, firstRead);
});

test("independent quiz assignments can receive different permutations", () => {
  const quizA = createQuizSpecificOrderingItemOrder(4, () => 0);
  const quizB = createQuizSpecificOrderingItemOrder(4, () => 0.5);

  assert.notDeepEqual(quizA, quizB);
  assert.deepEqual([...quizA].sort(), [0, 1, 2, 3]);
  assert.deepEqual([...quizB].sort(), [0, 1, 2, 3]);
});

test("invalid legacy assignments fall back to the canonical solution order", () => {
  assert.deepEqual(
    applyQuizSpecificOrderingItemOrder(items, [0, 0, 2, 3]),
    items,
  );
});

test("presentation renders ordering items instead of classic answer options", () => {
  const renderer = readFileSync(
    "app/rendering/presentation/PresentationSlideRenderer.tsx",
    "utf8",
  );
  const orderingBranch = renderer.slice(
    renderer.indexOf('templateData?.kind === "ORDERING"'),
    renderer.indexOf('templateData?.kind === "ESTIMATE"'),
  );

  assert.match(orderingBranch, /orderingItems\.length > 0/);
  assert.match(orderingBranch, /orderingItems\.map/);
  assert.doesNotMatch(orderingBranch, /antworten\.map/);
});
