import { evaluateCard, type BingoCard, type CardEvaluation } from '../core/cards';
import type { Draw } from '../core/round';

export type CardCheck = Readonly<{
  id: string; roundId: string; cardId: string; at: number;
  throughPosition: number; draws: readonly Draw[]; original: CardEvaluation;
}>;
export const CHECK_LABELS = ['Kein Bingo', 'Bingo', 'Doppel-Bingo', 'Triple-Bingo'] as const;
export function checkResult(evaluation: CardEvaluation) {
  const level = Math.min(3, evaluation.lines.length);
  return { level, label: CHECK_LABELS[level], lines: evaluation.lines.length };
}
export function checkEvaluation(check: CardCheck, card: BingoCard, draws: readonly Draw[]) {
  if (card.id !== check.cardId) throw Error('CARD_OR_CALL_NOT_FOUND');
  return evaluateCard(card.cells, draws.slice(0, check.throughPosition).map(d => d.number));
}
/** First-check order, one tile per round/card, append-only repeat history. */
export function groupChecks(checks: readonly CardCheck[]) {
  const groups = new Map<string, CardCheck[]>();
  for (const check of checks) {
    const key = `${check.roundId}:${check.cardId}`;
    const group = groups.get(key) ?? [];
    group.push(check); groups.set(key, group);
  }
  return [...groups.values()];
}
