import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createQuizSpecificOrderingAnswerIdOrder,
  formatOrderingAnswerForEvaluation,
  isPersistedQuizSpecificOrderingAnswerIdOrder,
  normalizeOrderingAnswerTextToAnswerIds,
  repairQuizSpecificOrderingAnswerIdOrders,
  resolveQuizSpecificOrderingAnswerIdOrder,
  resolveQuizSpecificOrderingParticipantItems,
} from "./orderingQuestionOrder";

const answers = [
  { antwort_id: 101, antwort: "Katze" },
  { antwort_id: 102, antwort: "Maus" },
  { antwort_id: 103, antwort: "Mensch" },
  { antwort_id: 104, antwort: "Hund" },
];

const items = [
  { id: "cat", text: "Katze" },
  { id: "mouse", text: "Maus" },
  { id: "human", text: "Mensch" },
  { id: "dog", text: "Hund" },
];

test("a stored quiz-specific ordering is stable for every consumer", () => {
  const storedOrder = [103, 104, 101, 102];
  const firstRead = resolveQuizSpecificOrderingParticipantItems(
    answers,
    storedOrder,
  );
  const reload = resolveQuizSpecificOrderingParticipantItems(
    answers,
    storedOrder,
  );

  assert.deepEqual(firstRead?.map((item) => item.id), ["103", "104", "101", "102"]);
  assert.deepEqual(firstRead?.map((item) => item.text), ["Mensch", "Hund", "Katze", "Maus"]);
  assert.deepEqual(reload, firstRead);
});

test("independent quiz assignments can receive different permutations", () => {
  const canonicalIds = answers.map((answer) => answer.antwort_id);
  const quizA = createQuizSpecificOrderingAnswerIdOrder(canonicalIds, () => 0);
  const quizB = createQuizSpecificOrderingAnswerIdOrder(canonicalIds, () => 0.5);

  assert.notDeepEqual(quizA, quizB);
  assert.deepEqual([...quizA].sort(), canonicalIds);
  assert.deepEqual([...quizB].sort(), canonicalIds);
  assert.notDeepEqual(quizA, canonicalIds);
  assert.notDeepEqual(quizB, canonicalIds);
});

test("invalid participant assignments never fall back to the solution", () => {
  assert.equal(
    resolveQuizSpecificOrderingParticipantItems(answers, [101, 101, 103, 104]),
    null,
  );
  assert.equal(
    resolveQuizSpecificOrderingParticipantItems(answers, [101, 102, 103, 104]),
    null,
  );
});

test("canonical and corrupted assignments are repaired with answer IDs", () => {
  const canonicalIds = answers.map((answer) => answer.antwort_id);
  for (const storedOrder of [canonicalIds, [101, 101, 103, 104], []]) {
    const resolved = resolveQuizSpecificOrderingAnswerIdOrder(
      canonicalIds,
      storedOrder,
      () => 0,
    );
    assert.equal(resolved.needsRepair, true);
    assert.equal(
      isPersistedQuizSpecificOrderingAnswerIdOrder(
        canonicalIds,
        resolved.order,
      ),
      true,
    );
    assert.notDeepEqual(resolved.order, canonicalIds);
  }
});

test("legacy indices are explicitly migrated to answer IDs", () => {
  const resolved = resolveQuizSpecificOrderingAnswerIdOrder(
    answers.map((answer) => answer.antwort_id),
    [2, 0, 3, 1],
  );

  assert.deepEqual(resolved, {
    order: [103, 101, 104, 102],
    needsRepair: true,
    source: "LEGACY_INDICES",
  });
});

test("repair persists once and every reload and team receives the same order", async () => {
  let persistedOrder = [2, 0, 3, 1];
  let writes = 0;
  const repair = () => repairQuizSpecificOrderingAnswerIdOrders(
    [{
      quizFragenId: 77,
      canonicalAnswerIds: answers.map((answer) => answer.antwort_id),
      storedOrder: persistedOrder,
    }],
    async ({ expectedOrder, nextOrder }) => {
      if (String(expectedOrder) !== String(persistedOrder)) return false;
      persistedOrder = [...nextOrder];
      writes += 1;
      return true;
    },
  );

  assert.equal(await repair(), 1);
  assert.deepEqual(persistedOrder, [103, 101, 104, 102]);
  assert.equal(await repair(), 0);
  assert.equal(writes, 1);

  const presentation = resolveQuizSpecificOrderingParticipantItems(
    answers,
    persistedOrder,
  );
  const teamA = resolveQuizSpecificOrderingParticipantItems(
    answers,
    persistedOrder,
  );
  const teamB = resolveQuizSpecificOrderingParticipantItems(
    answers,
    persistedOrder,
  );
  assert.deepEqual(teamA, presentation);
  assert.deepEqual(teamB, presentation);
});

test("evaluation formats current and legacy submissions as labels", () => {
  assert.equal(
    formatOrderingAnswerForEvaluation(
      answers,
      items,
      '["103","101","104","102"]',
    ),
    "Mensch → Katze → Hund → Maus",
  );
  assert.equal(
    formatOrderingAnswerForEvaluation(
      answers,
      items,
      '["human","cat","dog","mouse"]',
    ),
    "Mensch → Katze → Hund → Maus",
  );
  assert.equal(
    formatOrderingAnswerForEvaluation(answers, items, '["103","unknown"]'),
    "Ungültige Reihenfolge",
  );
  assert.equal(
    normalizeOrderingAnswerTextToAnswerIds(
      answers,
      items,
      '["human","cat","dog","mouse"]',
    ),
    '["103","101","104","102"]',
  );
});

test("presentation resolves participant labels from persisted answer IDs", () => {
  const renderer = readFileSync(
    "app/rendering/presentation/PresentationSlideRenderer.tsx",
    "utf8",
  );
  const orderingBranch = renderer.slice(
    renderer.indexOf('templateData?.kind === "ORDERING"'),
    renderer.indexOf('templateData?.kind === "ESTIMATE"'),
  );

  assert.match(orderingBranch, /resolveQuizSpecificOrderingParticipantItems/);
  assert.match(orderingBranch, /orderingItems\.length > 0/);
  assert.match(orderingBranch, /orderingItems\.map/);
  assert.doesNotMatch(orderingBranch, /templateData\.items\.map/);
});
