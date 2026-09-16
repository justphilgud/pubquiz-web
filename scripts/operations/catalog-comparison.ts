/** PostgreSQL can distribute a varchar-array -> text[] cast over its elements
 * when restoring decompiled DDL. Accept only that equivalence for simple enum-like
 * literals. Preserve every value, order, cast, operator and surrounding predicate.
 * This is deliberately not a general SQL normalizer.
 */
export function canonicalCatalogDefinition(sql: string): string {
  // Unsupported lexical forms fail closed, including escaped/dollar strings and
  // comments. Quoted strings/identifiers below are consumed whole, never rewritten.
  if (/[\\$]|--|\/\*/.test(sql)) return sql;
  const element = "'[A-Z_][A-Z_0-9]*'::character varying";
  const array = `\\(ARRAY\\[${element}(?:, ${element})*\\]\\)::text\\[\\]`;
  const tokens = new RegExp(`'(?:[^']|'')*'|"(?:[^"]|"")*"|${array}`, "g");
  return sql.replace(tokens, token => {
    if (!token.startsWith("(ARRAY[")) return token;
    const elements = token.slice("(ARRAY[".length, -"])::text[]".length).split(", ");
    return `ARRAY[${elements.map(value => `(${value})::text`).join(", ")}]`;
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Keep all catalog fields, sections and ordering, including unknown fields. */
export function canonicalCatalog(catalog: unknown): unknown {
  if (!record(catalog)) return catalog;
  return Object.fromEntries(Object.entries(catalog).map(([section, value]) => {
    const field = section === "constraints" ? "definition" : section === "indexes" ? "indexdef" : null;
    if (!field || !Array.isArray(value)) return [section, value];
    return [section, value.map((entry: unknown) => {
      if (!record(entry) || typeof entry[field] !== "string") return entry;
      return { ...entry, [field]: canonicalCatalogDefinition(entry[field]) };
    })];
  }));
}
