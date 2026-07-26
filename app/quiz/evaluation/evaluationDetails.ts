export function normalizeEvaluationText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE");
}

export function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}
