export type PublicTextReplacementRule = {
  id: number;
  searchTerm: string;
  replacement: string;
  active?: boolean;
};

const LEET_EQUIVALENTS: Record<string, string> = {
  a: "a4@",
  e: "e3",
  i: "i1!|",
  o: "o0",
  s: "s5$",
  t: "t7+",
};

function escapeCharacterClass(value: string) {
  return value.replace(/[\\\]\^-]/g, "\\$&");
}

function buildRulePattern(searchTerm: string) {
  const characters = Array.from(searchTerm.trim().toLocaleLowerCase("de-DE"))
    .filter((character) => /[\p{L}\p{N}]/u.test(character));
  if (characters.length < 2) return null;
  const body = characters.map((character) => {
    const equivalents = LEET_EQUIVALENTS[character] ?? character;
    return `[${escapeCharacterClass(equivalents)}]+`;
  }).join("[\\s._-]*");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu");
}

export function sanitizePublicLiveText(
  original: string,
  rules: readonly PublicTextReplacementRule[],
) {
  let publicText = original;
  const appliedRuleIds: number[] = [];
  for (const rule of rules) {
    if (rule.active === false) continue;
    const pattern = buildRulePattern(rule.searchTerm);
    if (!pattern || !pattern.test(publicText)) continue;
    pattern.lastIndex = 0;
    publicText = publicText.replace(pattern, rule.replacement);
    appliedRuleIds.push(rule.id);
  }
  return {
    publicText,
    changed: publicText !== original,
    appliedRuleIds,
  };
}
