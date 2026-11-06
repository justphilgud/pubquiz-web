/** Physical PDF geometry. V1/V2 renderers deliberately do not import this V3 contract. */
export const printFormats = {
  A4_FOUR: { label: 'DIN A4 · vier Karten', widthMm: 210, heightMm: 297, columns: 2, rows: 2, marginMm: 10, gapMm: 5 },
  A4_SIX: { label: 'DIN A4 · sechs Karten', widthMm: 210, heightMm: 297, columns: 2, rows: 3, marginMm: 10, gapMm: 5 },
  A6_ONE: { label: 'DIN A6 · eine Karte', widthMm: 105, heightMm: 148, columns: 1, rows: 1, marginMm: 6, gapMm: 0 },
} as const;
export type PrintFormat = keyof typeof printFormats;
export function printFormat(value: unknown): PrintFormat {
  if (typeof value !== 'string' || !Object.hasOwn(printFormats, value)) throw Error('Ungültiges Papierformat oder Kartenaufteilung.');
  return value as PrintFormat;
}
export function geometry(format: PrintFormat) {
  const f = printFormats[format];
  const sideMm = Math.min((f.widthMm - 2 * f.marginMm - (f.columns - 1) * f.gapMm) / f.columns, (f.heightMm - 2 * f.marginMm - (f.rows - 1) * f.gapMm) / f.rows);
  const pt = 72 / 25.4;
  return { ...f, capacity: f.columns * f.rows, sideMm, width: f.widthMm * pt, height: f.heightMm * pt, margin: f.marginMm * pt, gap: f.gapMm * pt, side: sideMm * pt };
}
/** Long-edge duplex mirrors slots, never glyphs or logos. Empty slots remain empty. */
export function position(format: PrintFormat, slot: number, back = false) {
  const g = geometry(format);
  if (!Number.isInteger(slot) || slot < 0 || slot >= g.capacity) throw Error('Ungültige Kartenposition.');
  const column = back ? g.columns - 1 - slot % g.columns : slot % g.columns;
  const left = (g.width - g.columns * g.side - (g.columns - 1) * g.gap) / 2;
  return { x: left + column * (g.side + g.gap), y: g.height - g.margin - g.side - Math.floor(slot / g.columns) * (g.side + g.gap), side: g.side };
}
/** Explicit export parts; never silently truncate a requested quantity. */
export function exportParts(count: number, maximum = 200) {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(maximum) || maximum < 1) throw Error('Ungültige Kartenmenge.');
  return Array.from({ length: Math.ceil(count / maximum) }, (_, index) => ({ from: index * maximum + 1, to: Math.min(count, (index + 1) * maximum) }));
}
