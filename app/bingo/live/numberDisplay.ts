import { requireNumber } from '../core/cards';

export const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
export function bingoLetter(number: number): string {
  requireNumber(number);
  return BINGO_LETTERS[Math.floor((number - 1) / 15)];
}
export function bingoNumber(number: number | null | undefined): string {
  return number == null ? '–' : `${bingoLetter(number)} ${number}`;
}
/** Deliberately rejects scientific notation, signs and decimal spelling too. */
export function parseNumberInput(value: string): number | null {
  if (!/^[1-9]\d?$/.test(value)) return null;
  const number = Number(value);
  return number <= 75 ? number : null;
}
