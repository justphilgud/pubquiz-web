import type { QuestionTemplateData } from "../types";

export const PAIRS_MAX = 10;
export const PAIR_TEXT_MAX = 120;
export type PairsData = Extract<QuestionTemplateData, { kind: "PAIRS" }>;
export type PairOption = { id: string; text: string };
export type PairMatch = [leftId: string, rightId: string];

export function defaultPairs(): PairsData {
  return {
    kind: "PAIRS",
    pairs: [
      { leftId: crypto.randomUUID(), rightId: crypto.randomUUID(), left: "", right: "" },
      { leftId: crypto.randomUUID(), rightId: crypto.randomUUID(), left: "", right: "" },
    ],
  };
}

export function parsePairs(value: unknown, complete: boolean): PairsData | null {
  const data = value as Partial<PairsData> | null;
  if (data?.kind !== "PAIRS" || !Array.isArray(data.pairs) ||
      data.pairs.length < 2 || data.pairs.length > PAIRS_MAX) return null;
  const ids = new Set<string>();
  const leftTexts = new Set<string>();
  const rightTexts = new Set<string>();
  for (const pair of data.pairs) {
    if (!pair) return null;
    for (const id of [pair.leftId, pair.rightId]) {
      if (typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id) || ids.has(id)) return null;
      ids.add(id);
    }
    for (const [text, seen] of [[pair.left, leftTexts], [pair.right, rightTexts]] as const) {
      if (typeof text !== "string" || text.length > PAIR_TEXT_MAX) return null;
      const normalized = text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
      if (complete && (!normalized || seen.has(normalized))) return null;
      seen.add(normalized);
    }
  }
  return { kind: "PAIRS", pairs: data.pairs.map(({ leftId, rightId, left, right }) =>
    ({ leftId, rightId, left: left.trim(), right: right.trim() })) };
}

// Sort by independent random identifiers on each side. No author positions
// or paired identifiers are sent to the participant.
export function pairColumns(data: PairsData) {
  const sort = (options: PairOption[]) => options.sort((a, b) => a.id.localeCompare(b.id));
  return {
    left: sort(data.pairs.map(({ leftId, left }) => ({ id: leftId, text: left }))),
    right: sort(data.pairs.map(({ rightId, right }) => ({ id: rightId, text: right }))),
  };
}

export function getPositionScoringItemCount(data: QuestionTemplateData | undefined) {
  return data?.kind === "PAIRS" ? data.pairs.length
    : data?.kind === "ORDERING" ? data.items.length : 0;
}

export function formatPairMatches(data: PairsData, answerText: string | null) {
  if (!answerText) return null;
  const { left, right } = pairColumns(data);
  const matches = readPairMatches(answerText, left, right);
  if (!matches) return "Ungültige Zuordnung";
  return matches.map(([leftId, rightId]) =>
    `${left.find(({ id }) => id === leftId)?.text} ↔ ${right.find(({ id }) => id === rightId)?.text}`,
  ).join(" · ") || null;
}

export function readPairMatches(
  text: string | null | undefined,
  left: readonly PairOption[],
  right: readonly PairOption[],
): PairMatch[] | null {
  let value: unknown;
  try { value = JSON.parse(text || "[]"); } catch { return null; }
  if (!Array.isArray(value) || value.length > Math.min(left.length, right.length)) return null;
  const remainingLeft = new Set(left.map(({ id }) => id));
  const remainingRight = new Set(right.map(({ id }) => id));
  const matches: PairMatch[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 ||
        typeof entry[0] !== "string" || typeof entry[1] !== "string" ||
        !remainingLeft.delete(entry[0]) || !remainingRight.delete(entry[1])) return null;
    matches.push([entry[0], entry[1]]);
  }
  return matches;
}
