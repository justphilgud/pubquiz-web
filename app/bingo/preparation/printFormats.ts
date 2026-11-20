/** Physical PDF geometry. V1/V2 renderers deliberately do not import this V3 contract. */
export const printFormats = {
  A4_FOUR: { label: 'DIN A4 · vier Karten', widthMm: 210, heightMm: 297, columns: 2, rows: 2, marginMm: 10, gapMm: 5 },
  A4_SIX: { label: 'DIN A4 · sechs Karten', widthMm: 210, heightMm: 297, columns: 2, rows: 3, marginMm: 10, gapMm: 5 },
  A6_ONE: { label: 'DIN A6 · eine Karte', widthMm: 105, heightMm: 148, columns: 1, rows: 1, marginMm: 6, gapMm: 0 },
  SRA3_TWELVE: { label: 'SRA3 · 12 Karten (320 × 450 mm)', widthMm: 320, heightMm: 450, columns: 3, rows: 4, marginMm: 10, gapMm: 5 },
} as const;
export type PrintFormat = keyof typeof printFormats;
export const cardProfiles = ['A4_FOUR', 'A4_SIX', 'A6_ONE'] as const;
export type CardProfile = typeof cardProfiles[number];
export type PrintLayout = { format: PrintFormat; cardProfile?: CardProfile };
export function cardProfile(format: PrintFormat, profile?: CardProfile): CardProfile {
  return format === 'SRA3_TWELVE' ? profile ?? 'A4_FOUR' : format;
}
export function changePrintFormat(current: PrintLayout, format: PrintFormat): PrintLayout {
  return format === 'SRA3_TWELVE' ? {format, cardProfile: cardProfile(current.format, current.cardProfile)} : {format};
}
export function parsePrintLayout(value: unknown): PrintLayout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Ungültige Druckmaße.');
  const r = value as Record<string, unknown>, format = printFormat(r.format);
  if (Object.keys(r).sort().join(',') !== (format === 'SRA3_TWELVE' ? 'cardProfile,format' : 'format') ||
      (format === 'SRA3_TWELVE' && !cardProfiles.includes(r.cardProfile as CardProfile))) throw Error('Bitte ein gültiges Kartenprofil wählen.');
  return format === 'SRA3_TWELVE' ? {format, cardProfile: r.cardProfile as CardProfile} : {format};
}
export function printFormat(value: unknown): PrintFormat {
  if (typeof value !== 'string' || !Object.hasOwn(printFormats, value)) throw Error('Ungültiges Papierformat oder Kartenaufteilung.');
  return value as PrintFormat;
}
export function geometry(format: PrintFormat, profile?: CardProfile) {
  const f = printFormats[format];
  const profileFormat = printFormats[cardProfile(format, profile)];
  const profileSide = Math.min((profileFormat.widthMm - 2 * profileFormat.marginMm - (profileFormat.columns - 1) * profileFormat.gapMm) / profileFormat.columns, (profileFormat.heightMm - 2 * profileFormat.marginMm - (profileFormat.rows - 1) * profileFormat.gapMm) / profileFormat.rows);
  const sideMm = profileSide;
  const pt = 72 / 25.4;
  return { ...f, capacity: f.columns * f.rows, sideMm, width: f.widthMm * pt, height: f.heightMm * pt, margin: f.marginMm * pt, gap: f.gapMm * pt, side: sideMm * pt };
}
/** Long-edge duplex mirrors slots, never glyphs or logos. Empty slots remain empty. */
export function position(format: PrintFormat, slot: number, back = false, profile?: CardProfile) {
  const g = geometry(format, profile);
  if (!Number.isInteger(slot) || slot < 0 || slot >= g.capacity) throw Error('Ungültige Kartenposition.');
  const column = back ? g.columns - 1 - slot % g.columns : slot % g.columns;
  const left = (g.width - g.columns * g.side - (g.columns - 1) * g.gap) / 2;
  const top = format === 'SRA3_TWELVE' ? (g.height - g.rows * g.side - (g.rows - 1) * g.gap) / 2 : g.margin;
  return { x: left + column * (g.side + g.gap), y: g.height - top - g.side - Math.floor(slot / g.columns) * (g.side + g.gap), side: g.side };
}
/** Explicit export parts; never silently truncate a requested quantity. */
export function exportParts(count: number, maximum = 200) {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(maximum) || maximum < 1) throw Error('Ungültige Kartenmenge.');
  return Array.from({ length: Math.ceil(count / maximum) }, (_, index) => ({ from: index * maximum + 1, to: Math.min(count, (index + 1) * maximum) }));
}
