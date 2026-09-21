import { createHash } from "node:crypto";

export const PILOT_COUNTRIES = [
  { iso2: "DE", iso3: "DEU", nameDe: "Deutschland" },
  { iso2: "IT", iso3: "ITA", nameDe: "Italien" },
  { iso2: "CL", iso3: "CHL", nameDe: "Chile" },
  { iso2: "AU", iso3: "AUS", nameDe: "Australien" },
  { iso2: "GM", iso3: "GMB", nameDe: "Gambia" },
];

export const OUTLINE_QUESTION = "Welches Land ist anhand dieses Umrisses zu erkennen?";
export const FLAG_QUESTION = "Welches Land hat diese Flagge?";

const MANUAL_OUTLINE_DISTRACTORS = {
  DE: ["PL", "AT", "CZ"],
  IT: ["HR", "GR", "PT"],
  CL: ["VN", "NO", "AR"],
  AU: ["MG", "ZA", "PG"],
  GM: ["SN", "TG", "MW"],
};

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizeCountryName(name) {
  return name.normalize("NFKC").trim();
}

export function buildOutlinePilotPlan(countries) {
  const byIso2 = new Map(countries.map((country) => [country.iso2, country]));
  return PILOT_COUNTRIES.map((pilot) => {
    const country = byIso2.get(pilot.iso2);
    if (!country || country.nameDe !== pilot.nameDe) {
      throw new Error(`COUNTRY_PILOT_CATALOGUE_MISMATCH:${pilot.iso2}`);
    }
    const distractors = MANUAL_OUTLINE_DISTRACTORS[pilot.iso2].map((iso2) => {
      const distractor = byIso2.get(iso2);
      if (!distractor) throw new Error(`COUNTRY_PILOT_DISTRACTOR_MISSING:${iso2}`);
      return { iso2, nameDe: distractor.nameDe };
    });
    return {
      ...pilot,
      question: OUTLINE_QUESTION,
      answers: [
        { iso2: pilot.iso2, nameDe: pilot.nameDe, isCorrect: true },
        ...distractors.map((entry) => ({ ...entry, isCorrect: false })),
      ],
    };
  });
}

export function validateQuestionAnswers(question) {
  if (!Array.isArray(question.answers) || question.answers.length !== 4) return false;
  const names = question.answers.map((answer) => normalizeCountryName(answer.nameDe));
  return new Set(names).size === 4 && question.answers.filter((answer) => answer.isCorrect).length === 1;
}

export function squaredRgbDistance(left, right) {
  if (left.length !== right.length) throw new Error("FLAG_DESCRIPTOR_LENGTH_MISMATCH");
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index] - right[index];
    total += delta * delta;
  }
  return total / left.length;
}

export function rankFlagDistractors(country, candidates) {
  return candidates
    .filter((candidate) => candidate.iso2 !== country.iso2)
    .map((candidate) => {
      const visualDistance = squaredRgbDistance(country.flagDescriptor, candidate.flagDescriptor);
      const geographyPenalty = country.subregion === candidate.subregion
        ? 0
        : country.region === candidate.region
          ? 0.018
          : 0.052;
      const aspectPenalty = Math.min(0.025, Math.abs(country.flagAspectRatio - candidate.flagAspectRatio) * 0.018);
      return { candidate, visualDistance, score: visualDistance + geographyPenalty + aspectPenalty };
    })
    .sort((left, right) => left.score - right.score || left.candidate.iso2.localeCompare(right.candidate.iso2));
}

export function selectFlagDistractors(country, countries) {
  const ranked = rankFlagDistractors(country, countries);
  const selected = [];
  let nearTwinSelected = false;
  for (const entry of ranked) {
    const nearTwin = entry.visualDistance < 0.0045;
    if (nearTwin && nearTwinSelected) continue;
    const duplicatesAnotherDistractor = selected.some((selectedEntry) =>
      squaredRgbDistance(selectedEntry.flagDescriptor, entry.candidate.flagDescriptor) < 0.0025,
    );
    if (duplicatesAnotherDistractor) continue;
    selected.push(entry.candidate);
    nearTwinSelected ||= nearTwin;
    if (selected.length === 3) break;
  }
  if (selected.length !== 3) throw new Error(`FLAG_DISTRACTOR_SELECTION_FAILED:${country.iso2}`);
  return selected;
}

export function validateCountryCatalogue(countries) {
  if (countries.length !== 193) throw new Error(`COUNTRY_CATALOGUE_COUNT:${countries.length}`);
  if (new Set(countries.map((country) => country.iso2)).size !== 193) throw new Error("COUNTRY_CATALOGUE_DUPLICATE_ISO2");
  if (new Set(countries.map((country) => normalizeCountryName(country.nameDe))).size !== 193) throw new Error("COUNTRY_CATALOGUE_DUPLICATE_NAME");
}
