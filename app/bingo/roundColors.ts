import { LOVD_RED } from './preparation/bingoPrint';

export const MAX_BINGO_ROUNDS = 10;
/** One shared source for new print snapshots and public round identification. */
export const ROUND_COLORS = [
  { name: 'LOVD-Rot', background: LOVD_RED, foreground: '#FFF9E9' },
  { name: 'Ozeanblau', background: '#174A75', foreground: '#FFFFFF' },
  { name: 'Waldgrün', background: '#24553A', foreground: '#FFFFFF' },
  { name: 'Aubergine', background: '#59335E', foreground: '#FFFFFF' },
  { name: 'Goldocker', background: '#99600E', foreground: '#FFFFFF' },
  { name: 'Petrol', background: '#12666B', foreground: '#FFFFFF' },
  { name: 'Himbeere', background: '#9B295A', foreground: '#FFFFFF' },
  { name: 'Nachtindigo', background: '#363979', foreground: '#FFFFFF' },
  { name: 'Kupfer', background: '#A04A23', foreground: '#FFFFFF' },
  { name: 'Schiefer', background: '#45545D', foreground: '#FFFFFF' },
] as const;
export function roundColor(round: number) {
  if (!Number.isInteger(round) || round < 1 || round > MAX_BINGO_ROUNDS) throw Error('ROUND_LIMIT');
  return ROUND_COLORS[round - 1];
}
