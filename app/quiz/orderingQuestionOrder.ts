type OrderingItem = { id: string; text: string };

export function isPersistedQuizSpecificOrderingItemOrder(
  itemCount: number,
  storedOrder: readonly number[],
) {
  const isPermutation =
    storedOrder.length === itemCount &&
    new Set(storedOrder).size === itemCount &&
    storedOrder.every(
      (index) => Number.isInteger(index) && index >= 0 && index < itemCount,
    );
  return isPermutation && (
    itemCount < 2 ||
    storedOrder.some((value, index) => value !== index)
  );
}

export function createQuizSpecificOrderingItemOrder(
  itemCount: number,
  random: () => number = Math.random,
) {
  const order = Array.from({ length: itemCount }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [order[index], order[target]] = [order[target], order[index]];
  }
  if (order.length > 1 && order.every((value, index) => value === index)) {
    order.push(order.shift()!);
  }
  return order;
}

export function applyQuizSpecificOrderingItemOrder<T extends OrderingItem>(
  items: readonly T[],
  storedOrder: readonly number[],
) {
  const valid =
    storedOrder.length === items.length &&
    new Set(storedOrder).size === items.length &&
    storedOrder.every(
      (index) => Number.isInteger(index) && index >= 0 && index < items.length,
    );
  return valid ? storedOrder.map((index) => items[index]) : [...items];
}

export function resolveQuizSpecificOrderingItemOrder(
  itemCount: number,
  storedOrder: readonly number[],
  random: () => number = Math.random,
) {
  if (isPersistedQuizSpecificOrderingItemOrder(itemCount, storedOrder)) {
    return { order: [...storedOrder], needsRepair: false };
  }
  return {
    order: createQuizSpecificOrderingItemOrder(itemCount, random),
    needsRepair: itemCount > 1,
  };
}

export function formatOrderingAnswerForEvaluation(
  items: readonly OrderingItem[],
  answerText: string | null,
) {
  if (!answerText?.trim()) return answerText;
  let itemIds: unknown;
  try {
    itemIds = JSON.parse(answerText);
  } catch {
    return "Ungültige Reihenfolge";
  }
  if (!Array.isArray(itemIds) || !itemIds.every((id) => typeof id === "string")) {
    return "Ungültige Reihenfolge";
  }
  const labels = new Map(items.map((item) => [item.id, item.text]));
  if (itemIds.some((id) => !labels.has(id))) return "Ungültige Reihenfolge";
  return itemIds.map((id) => labels.get(id)!).join(" → ");
}
