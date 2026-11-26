import { evaluateCard, type BingoCard } from '../core/cards';
import type { Draw } from '../core/round';

/** Aggregate only. Never expose waiting card identities or triggering numbers. */
export function bingoStatistics(cards: readonly BingoCard[], draws: readonly Draw[]) {
  const drawn = draws.map(d => d.number), seen = new Set(drawn);
  const remaining = Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !seen.has(n));
  const triggering = new Set<number>();
  let waitingCards = 0;
  for (const card of cards) {
    const completed = new Set(evaluateCard(card.cells, drawn).lines);
    let waiting = false;
    for (const number of remaining) {
      if (evaluateCard(card.cells, [...drawn, number]).lines.some(line => !completed.has(line))) {
        triggering.add(number);
        waiting = true;
      }
    }
    if (waiting) waitingCards++;
  }
  return { drawCount: draws.length, cardCount: cards.length, waitingCards,
    probability: remaining.length ? triggering.size / remaining.length * 100 : 0,
    remaining: remaining.length, basis: 'Alle generierten, dieser Runde zugeordneten Karten' };
}
