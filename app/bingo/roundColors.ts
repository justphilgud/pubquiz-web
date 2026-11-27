import { contrastRatio } from '@/app/rendering/presentationTemplates/presentationTemplate';

export const MAX_BINGO_ROUNDS = 10;
export function isRoundColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}
export function roundTheme(background: string) {
  if (!isRoundColor(background)) throw Error('INVALID_ROUND_COLOR');
  const foreground = ['#062C3D', '#FFFFFF', '#000000'].find(ink => contrastRatio(ink, background) >= 4.5)!;
  return { background: background.toUpperCase(), foreground };
}
/** Shared defaults for presentation and newly captured card backs; old PDFs stay frozen. */
export const ROUND_COLORS = [
  ['LOVD Red', '#6A241C'], ['Caramel Rust', '#C64D3B'], ['Creme Catalana', '#FFF9E9'],
  ['STELP Events Pure Matcha', '#307065'], ['STELP Events Matcha Latte', '#6FBEAC'],
  ['STELP Dunkelblau', '#062C3D'], ['STELP Hellblau', '#68BBCB'],
].map(([name, background]) => ({ name, ...roundTheme(background) }));
export function roundColor(round: number, override?: string | null) {
  if (!Number.isInteger(round) || round < 1 || round > MAX_BINGO_ROUNDS) throw Error('ROUND_LIMIT');
  return override ? { name: 'Individuell', ...roundTheme(override) } : ROUND_COLORS[(round - 1) % ROUND_COLORS.length];
}
