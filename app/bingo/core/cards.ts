/** Bingo 75 domain only: no clocks, persistence or runtime integrations. */
export type CardLayout = readonly (readonly (number | null)[])[];
export type BingoCard = Readonly<{ id: string; cells: CardLayout }>;
export type Stage = "BINGO" | "DOUBLE" | "TRIPLE";
export type LineId = `ROW_${1 | 2 | 3 | 4 | 5}` | `COL_${"B" | "I" | "N" | "G" | "O"}` | "DIAGONAL_DOWN" | "DIAGONAL_UP";
export type CardEvaluation = Readonly<{ lines: readonly LineId[]; stages: readonly Stage[] }>;

export function requireId(id: string): void {
  if (typeof id !== "string" || !id.trim()) throw new Error("ID_REQUIRED");
}

export function requireNumber(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 75) throw new Error("INVALID_NUMBER");
}

export function validateCard(cells: unknown): asserts cells is CardLayout {
  if (!Array.isArray(cells) || cells.length !== 5) throw new Error("INVALID_CARD_DIMENSIONS");
  const seen = new Set<number>();
  for (let row = 0; row < 5; row++) {
    if (!Array.isArray(cells[row]) || cells[row].length !== 5) throw new Error("INVALID_CARD_DIMENSIONS");
    for (let col = 0; col < 5; col++) {
      const value: unknown = cells[row][col];
      if (row === 2 && col === 2) {
        if (value !== null) throw new Error("FREE_CENTER_REQUIRED");
      } else {
        if (typeof value !== "number") throw new Error("INVALID_CARD_VALUE");
        requireNumber(value);
        if (value < col * 15 + 1 || value > (col + 1) * 15) throw new Error("INVALID_COLUMN_RANGE");
        if (seen.has(value)) throw new Error("DUPLICATE_CARD_NUMBER");
        seen.add(value);
      }
    }
  }
}

/** Identity is supplied independently; callers must later persist cells, not just a seed. */
export function generateCard(id: string, random: () => number): BingoCard {
  requireId(id);
  const cells: (number | null)[][] = Array.from({ length: 5 }, () => Array<number | null>(5).fill(null));
  for (let col = 0; col < 5; col++) {
    const pool = Array.from({ length: 15 }, (_, i) => col * 15 + i + 1);
    for (let row = 0; row < 5; row++) {
      if (col === 2 && row === 2) continue;
      const sample = random();
      if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error("INVALID_RANDOM_SAMPLE");
      cells[row][col] = pool.splice(Math.floor(sample * pool.length), 1)[0];
    }
  }
  return { id, cells };
}

const columns = ["B", "I", "N", "G", "O"] as const;
export const LINE_IDS: readonly LineId[] = Object.freeze([
  "ROW_1", "ROW_2", "ROW_3", "ROW_4", "ROW_5",
  "COL_B", "COL_I", "COL_N", "COL_G", "COL_O", "DIAGONAL_DOWN", "DIAGONAL_UP",
]);

/** Each call evaluates exactly one card; no aggregation across identities. */
export function evaluateCard(cells: CardLayout, drawn: readonly number[]): CardEvaluation {
  validateCard(cells);
  const marked = new Set<number>();
  for (const value of drawn) {
    requireNumber(value);
    if (marked.has(value)) throw new Error("DUPLICATE_DRAW_NUMBER");
    marked.add(value);
  }
  const hit = (r: number, c: number) => cells[r][c] === null || marked.has(cells[r][c] as number);
  const lines: LineId[] = [];
  for (let i = 0; i < 5; i++) if ([0, 1, 2, 3, 4].every(c => hit(i, c))) lines.push(`ROW_${(i + 1) as 1 | 2 | 3 | 4 | 5}`);
  for (let i = 0; i < 5; i++) if ([0, 1, 2, 3, 4].every(r => hit(r, i))) lines.push(`COL_${columns[i]}`);
  if ([0, 1, 2, 3, 4].every(i => hit(i, i))) lines.push("DIAGONAL_DOWN");
  if ([0, 1, 2, 3, 4].every(i => hit(i, 4 - i))) lines.push("DIAGONAL_UP");
  const stages: Stage[] = [];
  if (lines.length >= 1) stages.push("BINGO");
  if (lines.length >= 2) stages.push("DOUBLE");
  if (lines.length >= 3) stages.push("TRIPLE");
  return { lines, stages };
}
