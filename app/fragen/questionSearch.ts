import { COUNTRY_OPTIONS } from "@/app/lib/countries";
import type { Prisma } from "@/app/generated/prisma/client";

const aliases: Record<string, string[]> = { GB: ["Großbritannien", "Grossbritannien", "England", "UK", "United Kingdom"], US: ["USA", "Vereinigte Staaten", "United States"], CI: ["Elfenbeinküste"], CZ: ["Tschechien", "Tschechische Republik"] };
function normalize(value: string) { return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("de").replace(/ß/g, "ss"); }

export function questionSearchWhere(raw: string): Prisma.fragenWhereInput {
  const query = raw.trim().slice(0, 300);
  if (!query) return {};
  const countryCodes = COUNTRY_OPTIONS.filter(country => [country.label, country.value, ...(aliases[country.value] ?? [])]
    .some(value => normalize(value).includes(normalize(query)))).map(country => country.value);
  const id = Number(query.replace(/^#/, ""));
  return { OR: [
    ...(Number.isSafeInteger(id) && id > 0 ? [{ fragen_id: id }] : []),
    { frage: { contains: query, mode: "insensitive" } },
    { antworten: { some: { ist_richtig: true, OR: [
      { antwort: { contains: query, mode: "insensitive" } },
    ] } } },
    ...(countryCodes.length ? [{ vorlage: { code: "fakten_land" }, antworten: { some: { ist_richtig: true, antwort: { in: countryCodes } } } }] : []),
    { antwortfelder: { some: { loesungen: { some: { ist_akzeptiert: true, loesung_text: { contains: query, mode: "insensitive" } } } } } },
  ] };
}
