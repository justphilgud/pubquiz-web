export function normalizeQuestionForSimilarity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/\u00df/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value}  `;
  return new Set(
    Array.from({ length: Math.max(0, padded.length - 2) }, (_, index) =>
      padded.slice(index, index + 3),
    ),
  );
}

export function calculateQuestionSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeQuestionForSimilarity(left);
  const normalizedRight = normalizeQuestionForSimilarity(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const leftParts = trigrams(normalizedLeft);
  const rightParts = trigrams(normalizedRight);
  const intersection = [...leftParts].filter((part) => rightParts.has(part)).length;
  return (2 * intersection) / (leftParts.size + rightParts.size);
}

export function isPotentialQuestionDuplicate(left: string, right: string) {
  return calculateQuestionSimilarity(left, right) >= 0.58;
}
