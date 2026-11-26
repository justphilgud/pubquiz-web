import type { Draw } from '../core/round';
export type DrawSort = 'ORDER_ASC' | 'ORDER_DESC' | 'NUMBER_ASC' | 'NUMBER_DESC';
export function sortDraws(draws: readonly Draw[], sort: DrawSort): Draw[] {
  return [...draws].sort((a, b) => sort === 'ORDER_ASC' ? a.position - b.position :
    sort === 'ORDER_DESC' ? b.position - a.position : sort === 'NUMBER_ASC' ? a.number - b.number : b.number - a.number);
}
