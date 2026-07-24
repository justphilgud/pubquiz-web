import type {
  QuestionAnswerDraft,
  QuestionTemplateData,
} from "../types";
import { questionTemplateIds } from "./questionTemplateRegistry";

const defaults: Record<string, QuestionTemplateData> = {
  [questionTemplateIds.trueFalse]: {
    kind: "TRUE_FALSE",
    correctAnswer: true,
    explanation: "",
  },
  [questionTemplateIds.estimate]: {
    kind: "ESTIMATE",
    correctValue: null,
    unit: "",
    numberFormat: "INTEGER",
    explanation: "",
    tolerance: null,
  },
  [questionTemplateIds.ordering]: {
    kind: "ORDERING",
    items: [
      { id: "item-1", text: "", explanation: "" },
      { id: "item-2", text: "", explanation: "" },
    ],
    scoring: "EXACT",
  },
  [questionTemplateIds.translationReadAloud]: {
    kind: "TRANSLATION_READ_ALOUD",
    originalText: "",
    sourceLanguage: "en",
    targetLanguage: "de",
    translation: "",
    voiceProvider: "BROWSER",
    voiceId: "default",
    voiceStyle: "",
    voiceInstruction: "",
    speed: 1,
  },
  [questionTemplateIds.anagram]: {
    kind: "ANAGRAM",
    name: "",
    suggestions: [],
    selectedSolution: "",
    wordCountPreference: "AUTO",
  },
  [questionTemplateIds.googleReviews]: {
    kind: "GOOGLE_REVIEWS",
    placeId: "",
    placeName: "",
    placeAdditionalLabel: "",
    placeAverageRating: null,
    placeReviewCount: null,
    placeMapsUrl: "",
    placeImportedOrEditedAt: "",
    reviews: [{
      id: "review-1",
      text: "",
      authorName: "",
      rating: null,
      publishedLabel: "",
      sourceUrl: "",
      attributionText: "",
      importedOrEditedAt: "",
    }],
    explanation: "",
    sequentialReveal: true,
    hideAuthorUntilSolution: false,
    hideRatingUntilSolution: false,
  },
};

export function getDefaultQuestionTemplateData(
  templateId: string | null,
): QuestionTemplateData | undefined {
  const value = templateId ? defaults[templateId] : undefined;
  return value ? structuredClone(value) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown) {
  return value === null ||
    (typeof value === "number" && Number.isFinite(value))
    ? value
    : undefined;
}

export const TRANSLATION_TEXT_MAX_LENGTH = 2_000;
export const QUESTION_LANGUAGE_CODES = ["de", "en", "fr", "es", "it", "nl"] as const;
export const ANAGRAM_WORD_COUNT_PREFERENCES = ["AUTO", "2", "3", "4", "5", "ANY"] as const;

export type QuestionTemplateValidationIssue = {
  code:
    | "ESTIMATE_UNIT_REQUIRED"
    | "GOOGLE_PLACE_AVERAGE_RATING_INVALID"
    | "GOOGLE_PLACE_REVIEW_COUNT_INVALID";
  field:
    | "templateUnit"
    | "templatePlaceAverageRating"
    | "templatePlaceReviewCount";
  message: string;
};

function isValidGooglePlaceAverageRating(value: unknown): boolean {
  return value === null ||
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 5 &&
      Number.isInteger(value * 10);
}

function isValidGooglePlaceReviewCount(value: unknown): boolean {
  return value === null ||
    typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0;
}

export function parseGooglePlaceAverageRatingInput(
  value: string,
): number | null | undefined {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  if (!/^\d(?:[.,]\d)?$/.test(value.trim())) return undefined;
  const parsed = Number(normalized);
  return isValidGooglePlaceAverageRating(parsed) ? parsed : undefined;
}

export function parseGooglePlaceReviewCountInput(
  value: string,
): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = /^\d+$/.test(trimmed)
    ? trimmed
    : /^\d{1,3}(?:[.\s]\d{3})+$/.test(trimmed)
    ? trimmed.replace(/[.\s]/g, "")
    : "";
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return isValidGooglePlaceReviewCount(parsed) ? parsed : undefined;
}

export function getQuestionTemplateValidationIssue(
  value: unknown,
  templateId: string | null,
): QuestionTemplateValidationIssue | null {
  if (
    templateId === questionTemplateIds.googleReviews &&
    isRecord(value) &&
    value.kind === "GOOGLE_REVIEWS"
  ) {
    const averageRating = value.placeAverageRating ?? null;
    if (!isValidGooglePlaceAverageRating(averageRating)) {
      return {
        code: "GOOGLE_PLACE_AVERAGE_RATING_INVALID",
        field: "templatePlaceAverageRating",
        message: "Die durchschnittliche Bewertung muss zwischen 0 und 5 liegen.",
      };
    }
    const reviewCount = value.placeReviewCount ?? null;
    if (!isValidGooglePlaceReviewCount(reviewCount)) {
      return {
        code: "GOOGLE_PLACE_REVIEW_COUNT_INVALID",
        field: "templatePlaceReviewCount",
        message: "Die Anzahl der Rezensionen muss eine nicht negative ganze Zahl sein.",
      };
    }
  }
  const parsed = parseQuestionTemplateData(value, templateId, false);
  if (parsed?.kind === "ESTIMATE" && !parsed.unit.trim()) {
    return {
      code: "ESTIMATE_UNIT_REQUIRED",
      field: "templateUnit",
      message: "Bitte gib eine Einheit für die Schätzfrage an.",
    };
  }
  return null;
}

export function getLegacyTrueFalseStatement(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.templateData)) return "";
  return value.templateData.kind === "TRUE_FALSE" &&
    typeof value.templateData.statement === "string"
    ? value.templateData.statement
    : "";
}

export function resolveQuestionText(
  canonicalQuestionText: string,
  templateConfig: unknown,
): string {
  if (canonicalQuestionText.trim()) return canonicalQuestionText;
  return getLegacyTrueFalseStatement(templateConfig).trim() ||
    canonicalQuestionText;
}

export function isAllowedGoogleMapsUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "maps.app.goo.gl" ||
      host === "goo.gl" && url.pathname.startsWith("/maps") ||
      host === "maps.google.com" ||
      (host === "google.com" || host === "www.google.com") &&
        url.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

export function parseQuestionTemplateData(
  value: unknown,
  templateId: string | null,
  complete: boolean,
): QuestionTemplateData | undefined | null {
  const expected = getDefaultQuestionTemplateData(templateId);
  if (!expected) return value === undefined ? undefined : null;
  if (value === undefined) return expected;
  if (!isRecord(value) || value.kind !== expected.kind) return null;

  let parsed: QuestionTemplateData | null = null;
  if (value.kind === "TRUE_FALSE") {
    parsed = typeof value.correctAnswer === "boolean" &&
      text(value.explanation) !== null
      ? { kind: value.kind, correctAnswer: value.correctAnswer, explanation: text(value.explanation)! }
      : null;
  } else if (value.kind === "ESTIMATE") {
    const correctValue = numberOrNull(value.correctValue);
    const tolerance = numberOrNull(value.tolerance);
    parsed = correctValue !== undefined && tolerance !== undefined &&
      text(value.unit) !== null && text(value.explanation) !== null &&
      ["INTEGER", "DECIMAL", "YEAR", "PERCENT"].includes(String(value.numberFormat))
      ? { kind: value.kind, correctValue, tolerance, unit: text(value.unit)!, explanation: text(value.explanation)!, numberFormat: value.numberFormat as "INTEGER" | "DECIMAL" | "YEAR" | "PERCENT" }
      : null;
  } else if (value.kind === "ORDERING") {
    const items = Array.isArray(value.items)
      ? value.items.map((item) => isRecord(item) && text(item.id) !== null && text(item.text) !== null && text(item.explanation) !== null
        ? { id: text(item.id)!, text: text(item.text)!, explanation: text(item.explanation)! }
        : null)
      : [];
    parsed = items.every((item) => item !== null) && value.scoring === "EXACT"
      ? { kind: value.kind, items: items as Array<{ id: string; text: string; explanation: string }>, scoring: "EXACT" }
      : null;
  } else if (value.kind === "TRANSLATION_READ_ALOUD") {
    const legacyVoice = text(value.voice) ?? "default";
    parsed = [value.originalText, value.sourceLanguage, value.targetLanguage, value.translation].every((entry) => text(entry) !== null) &&
      (value.voiceProvider === undefined || value.voiceProvider === "BROWSER") &&
      (value.voiceId === undefined || text(value.voiceId) !== null) &&
      (value.voiceStyle === undefined || text(value.voiceStyle) !== null) &&
      (value.voiceInstruction === undefined || text(value.voiceInstruction) !== null) &&
      typeof value.speed === "number" && Number.isFinite(value.speed) && value.speed >= 0.5 && value.speed <= 2
      ? {
          kind: value.kind,
          originalText: text(value.originalText)!,
          sourceLanguage: text(value.sourceLanguage)!,
          targetLanguage: text(value.targetLanguage)!,
          translation: text(value.translation)!,
          voiceProvider: "BROWSER",
          voiceId: text(value.voiceId) ?? legacyVoice,
          voiceStyle: text(value.voiceStyle) ?? "",
          voiceInstruction: text(value.voiceInstruction) ?? "",
          speed: value.speed,
        }
      : null;
  } else if (value.kind === "ANAGRAM") {
    const wordCountPreference = value.wordCountPreference ?? "AUTO";
    parsed = text(value.name) !== null && text(value.selectedSolution) !== null &&
      Array.isArray(value.suggestions) && value.suggestions.every((entry) => typeof entry === "string") &&
      ANAGRAM_WORD_COUNT_PREFERENCES.includes(wordCountPreference as typeof ANAGRAM_WORD_COUNT_PREFERENCES[number])
      ? {
          kind: value.kind,
          name: text(value.name)!,
          selectedSolution: text(value.selectedSolution)!.toLocaleUpperCase("de-DE"),
          wordCountPreference: wordCountPreference as typeof ANAGRAM_WORD_COUNT_PREFERENCES[number],
          suggestions: value.suggestions
            .filter((entry) => isExactAnagram(text(value.name)!, entry))
            .map((entry) => entry.toLocaleUpperCase("de-DE")),
        }
      : null;
  } else if (value.kind === "GOOGLE_REVIEWS") {
    const placeAverageRating = value.placeAverageRating ?? null;
    const placeReviewCount = value.placeReviewCount ?? null;
    const reviews = Array.isArray(value.reviews)
      ? value.reviews.map((review) => isRecord(review) && text(review.id) !== null && text(review.text) !== null &&
        (review.authorName === undefined || text(review.authorName) !== null) &&
        (review.author === undefined || text(review.author) !== null) &&
        (review.publishedLabel === undefined || text(review.publishedLabel) !== null) &&
        (review.dateLabel === undefined || text(review.dateLabel) !== null) &&
        (review.sourceUrl === undefined || text(review.sourceUrl) !== null) &&
        (review.reviewSourceUrl === undefined || text(review.reviewSourceUrl) !== null) &&
        (review.attributionText === undefined || text(review.attributionText) !== null) &&
        (review.importedOrEditedAt === undefined || text(review.importedOrEditedAt) !== null) &&
        (review.rating === null || (typeof review.rating === "number" && Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5))
        ? {
            id: text(review.id)!,
            text: text(review.text)!,
            authorName: text(review.authorName) ?? text(review.author) ?? "",
            rating: review.rating as number | null,
            publishedLabel: text(review.publishedLabel) ?? text(review.dateLabel) ?? "",
            sourceUrl: text(review.sourceUrl) ?? text(review.reviewSourceUrl) ?? "",
            attributionText: text(review.attributionText) ?? "",
            importedOrEditedAt: text(review.importedOrEditedAt) ?? "",
          }
        : null)
      : [];
    const legacySourceUrl = text(value.sourceUrl) ?? "";
    parsed = (value.placeId === undefined || text(value.placeId) !== null) && text(value.placeName) !== null &&
      (value.placeAdditionalLabel === undefined || text(value.placeAdditionalLabel) !== null) &&
      isValidGooglePlaceAverageRating(placeAverageRating) &&
      isValidGooglePlaceReviewCount(placeReviewCount) &&
      (value.placeMapsUrl === undefined || text(value.placeMapsUrl) !== null) &&
      (value.mapsUrl === undefined || text(value.mapsUrl) !== null) &&
      (value.placeImportedOrEditedAt === undefined || text(value.placeImportedOrEditedAt) !== null) &&
      (value.accessedAt === undefined || text(value.accessedAt) !== null) && text(value.explanation) !== null &&
      typeof value.sequentialReveal === "boolean" &&
      (value.hideAuthorUntilSolution === undefined || typeof value.hideAuthorUntilSolution === "boolean") &&
      (value.hideRatingUntilSolution === undefined || typeof value.hideRatingUntilSolution === "boolean") &&
      reviews.every((review) => review !== null)
      ? {
          kind: value.kind,
          placeId: text(value.placeId) ?? "",
          placeName: text(value.placeName)!,
          placeAdditionalLabel: text(value.placeAdditionalLabel) ?? "",
          placeAverageRating: placeAverageRating as number | null,
          placeReviewCount: placeReviewCount as number | null,
          placeMapsUrl: text(value.placeMapsUrl) || text(value.mapsUrl) || legacySourceUrl,
          placeImportedOrEditedAt: text(value.placeImportedOrEditedAt) ?? text(value.accessedAt) ?? "",
          explanation: text(value.explanation)!,
          sequentialReveal: value.sequentialReveal,
          hideAuthorUntilSolution: value.hideAuthorUntilSolution ?? false,
          hideRatingUntilSolution: value.hideRatingUntilSolution ?? false,
          reviews: reviews as Extract<QuestionTemplateData, { kind: "GOOGLE_REVIEWS" }>["reviews"],
        }
      : null;
  }

  if (!parsed) return null;
  if (
    parsed.kind === "TRANSLATION_READ_ALOUD" &&
    (
      parsed.originalText.length > TRANSLATION_TEXT_MAX_LENGTH ||
      parsed.translation.length > TRANSLATION_TEXT_MAX_LENGTH
    )
  ) return null;
  if (
    parsed.kind === "GOOGLE_REVIEWS" &&
    (
      !isAllowedGoogleMapsUrl(parsed.placeMapsUrl) ||
      parsed.reviews.some((review) =>
        !isAllowedGoogleMapsUrl(review.sourceUrl)
      )
    )
  ) return null;
  if (!complete) return parsed;
  if (parsed.kind === "ESTIMATE" && (parsed.correctValue === null || !parsed.unit.trim())) return null;
  if (parsed.kind === "ORDERING" && (parsed.items.length < 2 || parsed.items.some((item) => !item.text.trim()) || new Set(parsed.items.map((item) => item.id)).size !== parsed.items.length)) return null;
  if (parsed.kind === "TRANSLATION_READ_ALOUD" && (
    !parsed.originalText.trim() ||
    !parsed.translation.trim() ||
    !QUESTION_LANGUAGE_CODES.some((code) => code === parsed.sourceLanguage) ||
    !QUESTION_LANGUAGE_CODES.some((code) => code === parsed.targetLanguage) ||
    parsed.sourceLanguage === parsed.targetLanguage
  )) return null;
  if (parsed.kind === "ANAGRAM" && (!parsed.name.trim() || !isExactAnagram(parsed.name, parsed.selectedSolution))) return null;
  if (parsed.kind === "GOOGLE_REVIEWS" && (!parsed.placeName.trim() || parsed.reviews.length === 0 || parsed.reviews.some((review) => !review.text.trim()))) return null;
  return parsed;
}

export function normalizeAnagramLetters(value: string): string {
  return [...value.normalize("NFKD").toLocaleLowerCase("de-DE")]
    .filter((character) => /\p{L}|\p{N}/u.test(character))
    .sort()
    .join("");
}

export function isExactAnagram(source: string, candidate: string): boolean {
  return Boolean(candidate.trim()) &&
    normalizeAnagramLetters(source) === normalizeAnagramLetters(candidate);
}

const anagramDictionary = [
  "A", "I", "AM", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "HE", "IN",
  "IS", "IT", "ME", "MY", "NO", "OF", "ON", "OR", "SO", "TO", "UP", "US",
  "WE", "AND", "ARE", "ART", "BAD", "BAR", "BAT", "BED", "BIG", "BIT",
  "BLUE", "BOOK", "BOY", "CAR", "CAT", "CLASS", "CLASSROOM", "DAY", "DIE",
  "DOG", "EIN", "EINE", "END", "EYES", "FAR", "FAST", "FIRE", "FISH",
  "FOR", "FRAU", "FUN", "GAME", "GIRL", "GOOD", "GREEN", "HAUS", "HER",
  "HERR", "HOME", "HOT", "KIND", "KLEIN", "LAND", "LIFE", "LIGHT", "LORD",
  "LOVE", "MAN", "MANN", "MIT", "MOON", "MORE", "MOUSE", "MUSIC", "NACH",
  "NIGHT", "NOT", "OLD", "ONE", "RANT", "RED", "ROAD", "ROOM", "RUN",
  "SCHOOL", "SEA", "SEE", "SILENT", "SING", "SONG", "STAR", "STONE",
  "SUN", "TAG", "THE", "THEY", "TIME", "TONES", "TREE", "UND", "VON",
  "VOICE", "VOICES", "WASSER", "WAY", "WELT", "WIND", "WOMAN", "WORD",
  "WORLD", "ZEIT",
] as const;

function subtractLetters(available: string, requested: string): string | null {
  const remaining = [...available];
  for (const character of requested) {
    const index = remaining.indexOf(character);
    if (index < 0) return null;
    remaining.splice(index, 1);
  }
  return remaining.join("");
}

export type AnagramSuggestionQuality =
  | "DICTIONARY"
  | "MIXED"
  | "PRONOUNCEABLE"
  | "FALLBACK";

export type AnagramSuggestionCandidate = {
  value: string;
  quality: AnagramSuggestionQuality;
  score: number;
};

const anagramQualityRank: Record<AnagramSuggestionQuality, number> = {
  DICTIONARY: 4,
  MIXED: 3,
  PRONOUNCEABLE: 2,
  FALLBACK: 1,
};
const anagramVowels = new Set([..."aeiouyäöü"]);
const commonLetterGroups = [
  "ch", "sch", "st", "sp", "tr", "dr", "gr", "kr", "br", "pr", "th",
  "sh", "ck", "ng", "en", "er", "el", "an", "in", "on", "ar", "or",
];

function normalizeAnagramSequence(value: string): string {
  return [...value.normalize("NFKD").toLocaleLowerCase("de-DE")]
    .filter((character) => /\p{L}|\p{N}/u.test(character))
    .join("");
}

function isRotation(candidate: string, original: string): boolean {
  return candidate.length === original.length &&
    candidate !== original &&
    (original + original).includes(candidate);
}

function seededShuffle(value: string, initialSeed: number): string {
  const characters = [...value];
  let seed = initialSeed || 1;
  for (let index = characters.length - 1; index > 0; index--) {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    const target = seed % (index + 1);
    [characters[index], characters[target]] =
      [characters[target], characters[index]];
  }
  return characters.join("");
}

function splitAnagramSequence(
  value: string,
  segmentCount: number,
  seed: number,
): string[] {
  const lengths = Array.from(
    { length: segmentCount },
    (_, index) =>
      Math.floor(value.length / segmentCount) +
      (index < value.length % segmentCount ? 1 : 0),
  );
  if (lengths.length > 1 && seed % 3 === 0) {
    const donor = lengths.findIndex((length) => length > 3);
    const receiver = lengths.findIndex((length, index) =>
      index !== donor && length < 8
    );
    if (donor >= 0 && receiver >= 0) {
      lengths[donor] -= 1;
      lengths[receiver] += 1;
    }
  }
  const segments: string[] = [];
  let offset = 0;
  for (const length of lengths) {
    segments.push(value.slice(offset, offset + length));
    offset += length;
  }
  return segments;
}

function pronunciationScore(segment: string): number {
  if (segment.length < 2 || segment.length > 9) return -30;
  let score = 4;
  let vowelRun = 0;
  let consonantRun = 0;
  let hasVowel = false;
  for (const character of segment) {
    if (anagramVowels.has(character)) {
      hasVowel = true;
      vowelRun += 1;
      consonantRun = 0;
      if (vowelRun > 2) score -= 4;
    } else {
      consonantRun += 1;
      vowelRun = 0;
      if (consonantRun > 2) score -= 5;
    }
  }
  if (!hasVowel) score -= 12;
  for (const group of commonLetterGroups) {
    if (segment.includes(group)) score += 2;
  }
  return score;
}

function arrangementScore(
  segments: readonly string[],
  originalSequence: string,
): number {
  const compact = segments.join("");
  const positionalDistance = [...compact].filter(
    (character, index) => character !== originalSequence[index],
  ).length;
  return segments.reduce((total, segment) =>
    total + pronunciationScore(segment), 0
  ) + positionalDistance - Math.abs(segments.length - 3) * 2;
}

function canUseCandidate(
  source: string,
  segments: readonly string[],
  originalParts: ReadonlySet<string>,
): boolean {
  const value = segments.join(" ");
  const normalizedSegments = segments.map(normalizeAnagramSequence);
  const compact = normalizedSegments.join("");
  const originalSequence = normalizeAnagramSequence(source);
  return isExactAnagram(source, value) &&
    compact !== originalSequence &&
    compact !== [...originalSequence].reverse().join("") &&
    !isRotation(compact, originalSequence) &&
    !normalizedSegments.some((segment) =>
      segment.length > 1 && originalParts.has(segment)
    );
}

export function generateAnagramSuggestionCandidates(
  source: string,
  limit = 8,
): AnagramSuggestionCandidate[] {
  const available = normalizeAnagramLetters(source);
  if (available.length < 4 || available.length > 40) return [];
  const originalSequence = normalizeAnagramSequence(source);
  const originalParts = new Set(
    source.toLocaleLowerCase("de-DE")
      .split(/[\s-]+/)
      .map(normalizeAnagramSequence)
      .filter(Boolean),
  );
  const dictionary = anagramDictionary
    .map((word) => ({
      word,
      letters: normalizeAnagramLetters(word),
    }))
    .filter(({ word, letters }) =>
      letters.length <= available.length &&
      !originalParts.has(normalizeAnagramSequence(word)) &&
      subtractLetters(available, letters) !== null
    )
    .sort((left, right) =>
      right.letters.length - left.letters.length ||
      left.word.localeCompare(right.word, "de")
    );
  const candidates = new Map<string, AnagramSuggestionCandidate>();

  function add(
    segments: readonly string[],
    quality: AnagramSuggestionQuality,
    score: number,
  ) {
    const normalizedSegments = segments.map((segment) =>
      segment.toLocaleUpperCase("de-DE")
    );
    if (!canUseCandidate(source, normalizedSegments, originalParts)) return;
    const value = normalizedSegments.join(" ");
    const current = candidates.get(value);
    if (!current || anagramQualityRank[quality] > anagramQualityRank[current.quality] ||
      score > current.score) {
      candidates.set(value, { value, quality, score });
    }
  }

  function searchDictionary(
    remaining: string,
    words: string[],
    targetCount: number,
    startIndex: number,
  ) {
    if (candidates.size >= 80) return;
    if (!remaining) {
      if (words.length === targetCount) {
        add(words, "DICTIONARY", 400 - targetCount * 4);
        if (words.length > 1) {
          add([...words].reverse(), "DICTIONARY", 399 - targetCount * 4);
        }
      }
      return;
    }
    if (words.length >= targetCount) return;
    for (let index = startIndex; index < dictionary.length; index++) {
      const entry = dictionary[index];
      const next = subtractLetters(remaining, entry.letters);
      if (next !== null) {
        searchDictionary(
          next,
          [...words, entry.word],
          targetCount,
          index,
        );
      }
    }
  }

  for (const count of [2, 3, 4, 5]) {
    searchDictionary(available, [], count, 0);
  }

  for (const [dictionaryIndex, entry] of dictionary.slice(0, 60).entries()) {
    const remaining = subtractLetters(available, entry.letters);
    if (!remaining || remaining.length < 2) continue;
    for (let variant = 1; variant <= 12; variant++) {
      const shuffled = seededShuffle(
        remaining,
        (dictionaryIndex + 1) * 97 + variant * 31,
      );
      const restCount = Math.max(
        1,
        Math.min(3, Math.ceil(shuffled.length / 7)),
      );
      const rest = splitAnagramSequence(shuffled, restCount, variant);
      const segments = variant % 2 === 0
        ? [entry.word, ...rest]
        : [...rest, entry.word];
      const score = arrangementScore(
        segments.map(normalizeAnagramSequence),
        originalSequence,
      );
      if (score >= 0) add(segments, "MIXED", 250 + score);
    }
  }

  const generatedFallbacks: Array<{ segments: string[]; score: number }> = [];
  const minimumSegments = Math.max(2, Math.ceil(available.length / 9));
  const maximumSegments = Math.min(5, Math.floor(available.length / 2));
  for (let variant = 1; variant <= 600; variant++) {
    const shuffled = seededShuffle(available, variant * 2_654_435_761);
    const segmentCount = minimumSegments +
      variant % Math.max(1, maximumSegments - minimumSegments + 1);
    const segments = splitAnagramSequence(shuffled, segmentCount, variant);
    if (!canUseCandidate(source, segments, originalParts)) continue;
    const score = arrangementScore(segments, originalSequence);
    generatedFallbacks.push({ segments, score });
    if (score >= 4) add(segments, "PRONOUNCEABLE", 120 + score);
  }

  if (![...candidates.values()].some((candidate) =>
    candidate.quality !== "FALLBACK"
  )) {
    for (const fallback of generatedFallbacks
      .sort((left, right) => right.score - left.score)
      .slice(0, limit * 2)) {
      add(fallback.segments, "FALLBACK", fallback.score);
    }
  }

  return [...candidates.values()]
    .sort((left, right) =>
      anagramQualityRank[right.quality] - anagramQualityRank[left.quality] ||
      right.score - left.score ||
      left.value.localeCompare(right.value, "de")
    )
    .slice(0, limit);
}

export function generateAnagramSuggestions(
  source: string,
  limit = 8,
): string[] {
  return generateAnagramSuggestionCandidates(source, limit)
    .map((candidate) => candidate.value);
}

export function getAnswersForTemplateData(
  data: QuestionTemplateData,
  current: readonly QuestionAnswerDraft[],
): QuestionAnswerDraft[] {
  const base = (index: number, value: string, isCorrect = true): QuestionAnswerDraft => ({
    id: current[index]?.id ?? `template-answer-${index + 1}`,
    answerId: current[index]?.answerId,
    text: value,
    isCorrect,
    additionalInfo: "",
    media: null,
  });
  if (data.kind === "TRUE_FALSE") {
    return [base(0, "Wahr", data.correctAnswer), base(1, "Falsch", !data.correctAnswer)];
  }
  if (data.kind === "ESTIMATE") {
    return [base(0, data.correctValue === null ? "" : String(data.correctValue))];
  }
  if (data.kind === "ORDERING") {
    return data.items.map((item, index) => ({ ...base(index, item.text), additionalInfo: item.explanation }));
  }
  if (data.kind === "TRANSLATION_READ_ALOUD") {
    return current.length > 0 ? [...current] : [base(0, "")];
  }
  if (data.kind === "ANAGRAM") {
    return [base(0, data.name)];
  }
  return [base(0, data.placeName)];
}
