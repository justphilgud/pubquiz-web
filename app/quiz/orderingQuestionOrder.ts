type OrderingTemplateItem = { id: string; text: string };

type OrderingAnswerIdentity = {
  antwort_id: number;
};

type OrderingAnswer = OrderingAnswerIdentity & {
  antwort: string;
};

type OrderingOrderSource =
  | "PERSISTED_ANSWER_IDS"
  | "LEGACY_INDICES"
  | "GENERATED";

function isExactPermutation(
  values: readonly number[],
  expectedValues: readonly number[],
) {
  if (
    values.length !== expectedValues.length ||
    new Set(values).size !== expectedValues.length
  ) {
    return false;
  }
  const expected = new Set(expectedValues);
  return values.every((value) => Number.isInteger(value) && expected.has(value));
}

function isCanonicalOrder(
  values: readonly number[],
  canonicalValues: readonly number[],
) {
  return values.every((value, index) => value === canonicalValues[index]);
}

export function isPersistedQuizSpecificOrderingAnswerIdOrder(
  canonicalAnswerIds: readonly number[],
  storedOrder: readonly number[],
) {
  return (
    canonicalAnswerIds.length >= 2 &&
    isExactPermutation(storedOrder, canonicalAnswerIds) &&
    !isCanonicalOrder(storedOrder, canonicalAnswerIds)
  );
}

export function createQuizSpecificOrderingAnswerIdOrder(
  canonicalAnswerIds: readonly number[],
  random: () => number = Math.random,
) {
  if (canonicalAnswerIds.length < 2) {
    throw new Error(
      "Eine Ordering-Frage benötigt mindestens zwei Antworten für eine Nicht-Lösungs-Reihenfolge.",
    );
  }
  if (new Set(canonicalAnswerIds).size !== canonicalAnswerIds.length) {
    throw new Error("Die Antwort-IDs einer Ordering-Frage sind nicht eindeutig.");
  }

  const order = [...canonicalAnswerIds];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [order[index], order[target]] = [order[target], order[index]];
  }
  if (isCanonicalOrder(order, canonicalAnswerIds)) {
    order.push(order.shift()!);
  }
  return order;
}

export function resolveQuizSpecificOrderingAnswerIdOrder(
  canonicalAnswerIds: readonly number[],
  storedOrder: readonly number[],
  random: () => number = Math.random,
): {
  order: number[];
  needsRepair: boolean;
  source: OrderingOrderSource;
} {
  if (
    isPersistedQuizSpecificOrderingAnswerIdOrder(
      canonicalAnswerIds,
      storedOrder,
    )
  ) {
    return {
      order: [...storedOrder],
      needsRepair: false,
      source: "PERSISTED_ANSWER_IDS",
    };
  }

  const legacyIndices = canonicalAnswerIds.map((_, index) => index);
  if (isExactPermutation(storedOrder, legacyIndices)) {
    const migratedOrder = storedOrder.map((index) => canonicalAnswerIds[index]);
    if (!isCanonicalOrder(migratedOrder, canonicalAnswerIds)) {
      return {
        order: migratedOrder,
        needsRepair: true,
        source: "LEGACY_INDICES",
      };
    }
  }

  return {
    order: createQuizSpecificOrderingAnswerIdOrder(canonicalAnswerIds, random),
    needsRepair: true,
    source: "GENERATED",
  };
}

export async function repairQuizSpecificOrderingAnswerIdOrders(
  assignments: readonly {
    quizFragenId: number;
    canonicalAnswerIds: readonly number[];
    storedOrder: readonly number[];
  }[],
  persist: (input: {
    quizFragenId: number;
    expectedOrder: readonly number[];
    nextOrder: readonly number[];
  }) => Promise<boolean>,
  random: () => number = Math.random,
) {
  let repairedAssignments = 0;
  for (const assignment of assignments) {
    const resolved = resolveQuizSpecificOrderingAnswerIdOrder(
      assignment.canonicalAnswerIds,
      assignment.storedOrder,
      random,
    );
    if (!resolved.needsRepair) continue;
    const persisted = await persist({
      quizFragenId: assignment.quizFragenId,
      expectedOrder: assignment.storedOrder,
      nextOrder: resolved.order,
    });
    if (persisted) repairedAssignments += 1;
  }
  return repairedAssignments;
}

export function resolveQuizSpecificOrderingParticipantItems(
  canonicalAnswers: readonly OrderingAnswer[],
  storedOrder: readonly number[],
) {
  const canonicalAnswerIds = canonicalAnswers.map((answer) => answer.antwort_id);
  if (
    !isPersistedQuizSpecificOrderingAnswerIdOrder(
      canonicalAnswerIds,
      storedOrder,
    )
  ) {
    return null;
  }

  const answersById = new Map(
    canonicalAnswers.map((answer) => [answer.antwort_id, answer]),
  );
  return storedOrder.map((answerId) => {
    const answer = answersById.get(answerId)!;
    return { id: String(answer.antwort_id), text: answer.antwort };
  });
}

export function normalizeOrderingAnswerTextToAnswerIds(
  canonicalAnswers: readonly OrderingAnswerIdentity[],
  legacyTemplateItems: readonly OrderingTemplateItem[],
  answerText: string | null,
) {
  if (!answerText?.trim()) return answerText;

  let submittedIds: unknown;
  try {
    submittedIds = JSON.parse(answerText);
  } catch {
    return answerText;
  }
  if (
    !Array.isArray(submittedIds) ||
    submittedIds.length !== canonicalAnswers.length ||
    new Set(submittedIds).size !== submittedIds.length
  ) {
    return answerText;
  }

  const answerIds = canonicalAnswers.map((answer) => String(answer.antwort_id));
  if (
    submittedIds.every(
      (id) => typeof id === "string" && answerIds.includes(id),
    )
  ) {
    return JSON.stringify(submittedIds);
  }

  if (legacyTemplateItems.length !== canonicalAnswers.length) {
    return answerText;
  }
  const answerIdByLegacyItemId = new Map(
    legacyTemplateItems.map((item, index) => [item.id, answerIds[index]]),
  );
  if (
    !submittedIds.every(
      (id) => typeof id === "string" && answerIdByLegacyItemId.has(id),
    )
  ) {
    return answerText;
  }
  return JSON.stringify(
    submittedIds.map((id) => answerIdByLegacyItemId.get(String(id))!),
  );
}

export function formatOrderingAnswerForEvaluation(
  canonicalAnswers: readonly OrderingAnswer[],
  legacyTemplateItems: readonly OrderingTemplateItem[],
  answerText: string | null,
) {
  if (!answerText?.trim()) return answerText;
  const normalized = normalizeOrderingAnswerTextToAnswerIds(
    canonicalAnswers,
    legacyTemplateItems,
    answerText,
  );
  let answerIds: unknown;
  try {
    answerIds = JSON.parse(normalized ?? "");
  } catch {
    return "Ungültige Reihenfolge";
  }
  if (
    !Array.isArray(answerIds) ||
    answerIds.length !== canonicalAnswers.length ||
    !answerIds.every((id) => typeof id === "string")
  ) {
    return "Ungültige Reihenfolge";
  }
  const labelsById = new Map(
    canonicalAnswers.map((answer) => [String(answer.antwort_id), answer.antwort]),
  );
  if (answerIds.some((id) => !labelsById.has(id))) {
    return "Ungültige Reihenfolge";
  }
  return answerIds.map((id) => labelsById.get(id)!).join(" → ");
}
