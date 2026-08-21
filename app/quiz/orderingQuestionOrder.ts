type OrderingItem = { id: string; text: string };

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
