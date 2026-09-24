import { normalizeQuestionForSimilarity } from "@/app/fragen/editor/questionSimilarity";
import type {
  ExternalQuestion,
  ExternalQuestionAutomationResult,
  ExternalQuestionEnrichment,
  ExternalQuestionIssueCode,
  ExternalQuestionQualityStatus,
} from "./types";

const CATEGORY_MAPPING: Record<string, string> = {
  "Animals": "Natur",
  "Celebrities": "Promis",
  "Entertainment: Board Games": "Spiele",
  "Entertainment: Books": "Literatur",
  "Entertainment: Cartoon & Animations": "Film & Fernsehen",
  "Entertainment: Comics": "Comics",
  "Entertainment: Film": "Film & Fernsehen",
  "Entertainment: Japanese Anime & Manga": "Anime & Manga",
  "Entertainment: Music": "Musik",
  "Entertainment: Musicals & Theatres": "Theater & Musical",
  "Entertainment: Television": "Film & Fernsehen",
  "Entertainment: Video Games": "Videospiele",
  "General Knowledge": "Allgemeinwissen",
  "Geography": "Geografie",
  "History": "Geschichte",
  "Mythology": "Mythologie",
  "Politics": "Politik",
  "Science & Nature": "Naturwissenschaften",
  "Science: Computers": "Computer & Technik",
  "Science: Gadgets": "Computer & Technik",
  "Science: Mathematics": "Mathematik",
  "Sports": "Sport",
  "Vehicles": "Fahrzeuge",
};

const TIME_SENSITIVE = /\b(current|currently|as of|this year|today|now|latest|most recent|incumbent|presently)\b/i;
const LANGUAGE_DEPENDENT = /\b(spell|spelled|letter|word|rhyme|pronounc|anagram|English word|acronym)\b/i;
const LOCALE_SPECIFIC = /\b(US state|U\.S\. state|British county|UK postcode|American football conference)\b/i;

export function mapOpenTdbCategory(category: string) {
  return CATEGORY_MAPPING[category] ?? "";
}

export function mapOpenTdbDifficulty(difficulty: ExternalQuestion["difficulty"]) {
  return difficulty === "easy" ? 25 : difficulty === "medium" ? 50 : 75;
}

function answerIssues(
  correctAnswer: string,
  incorrectAnswers: readonly string[],
): ExternalQuestionIssueCode[] {
  const answers = [correctAnswer, ...incorrectAnswers];
  const normalized = answers.map(normalizeQuestionForSimilarity);
  const issues: ExternalQuestionIssueCode[] = [];
  if (
    answers.some((answer) => !answer || answer.length > 200) ||
    incorrectAnswers.length !== 3
  ) {
    issues.push("MALFORMED_CONTENT");
  }
  if (new Set(normalized).size !== normalized.length) {
    issues.push("DUPLICATE_ANSWER");
  }
  if (answers.some((answer) => normalizeQuestionForSimilarity(answer).length < 1)) {
    issues.push("POOR_DISTRACTOR");
  }
  return issues;
}

export function evaluateExternalQuestionQuality(input: {
  question: ExternalQuestion;
  enrichment: ExternalQuestionEnrichment | null;
  automation?: ExternalQuestionAutomationResult | null;
}) {
  const issues = new Set<ExternalQuestionIssueCode>();
  const { question, enrichment } = input;
  const automation = input.automation ?? null;
  const categorySuggestion =
    enrichment?.suggestedCategoryName || mapOpenTdbCategory(question.category);

  if (!question.question || question.question.length > 300) issues.add("MALFORMED_CONTENT");
  if (!question.question.endsWith("?")) issues.add("AMBIGUOUS_QUESTION");
  if (TIME_SENSITIVE.test(question.question)) issues.add("TIME_SENSITIVE");
  if (LANGUAGE_DEPENDENT.test(question.question)) issues.add("LANGUAGE_DEPENDENT");
  if (LOCALE_SPECIFIC.test(question.question)) issues.add("LOCALE_SPECIFIC");
  if (!categorySuggestion) issues.add("CATEGORY_UNMAPPED");
  for (const issue of answerIssues(question.correctAnswer, question.incorrectAnswers)) {
    issues.add(issue);
  }

  if (!enrichment) {
    issues.add("MISSING_TRANSLATION");
    issues.add("MISSING_FACT_SOURCE");
  } else {
    if (
      normalizeQuestionForSimilarity(enrichment.question) ===
      normalizeQuestionForSimilarity(question.question)
    ) {
      issues.add("MISSING_TRANSLATION");
    }
    for (const issue of answerIssues(enrichment.correctAnswer, enrichment.incorrectAnswers)) {
      issues.add(issue);
    }
    if (!enrichment.verificationSourceUrl || !enrichment.verificationSourceTitle) {
      issues.add("MISSING_FACT_SOURCE");
    }
  }

  if (automation) {
    if (automation.localizationStatus === "REVIEW_REQUIRED") {
      issues.add("LOCALIZATION_UNCERTAIN");
    }
    if (automation.verificationStatus === "CONTRADICTED") {
      issues.add("FACT_CONTRADICTED");
    } else if (automation.verificationStatus === "AMBIGUOUS") {
      issues.add("FACT_AMBIGUOUS");
    } else if (
      automation.verificationStatus === "NO_RELIABLE_SOURCE" ||
      automation.verificationSources.length === 0
    ) {
      issues.add("MISSING_FACT_SOURCE");
    }
    if (automation.flags.ambiguous) issues.add("AMBIGUOUS_QUESTION");
    if (automation.flags.languageDependent) issues.add("LANGUAGE_DEPENDENT");
    if (automation.flags.localContext) issues.add("LOCALE_SPECIFIC");
    if (automation.flags.poorDistractor) issues.add("POOR_DISTRACTOR");
    if (automation.flags.sourceQualityLow) issues.add("SOURCE_QUALITY_LOW");
    if (automation.flags.timeSensitive) issues.add("TIME_SENSITIVE");
  }

  const autoRejected =
    issues.has("MALFORMED_CONTENT") ||
    issues.has("DUPLICATE_ANSWER") ||
    issues.has("UNSUPPORTED_TYPE");

  return {
    issues: [...issues],
    autoRejected,
    suggestedCategoryName: categorySuggestion || question.category,
    mappedDifficulty: mapOpenTdbDifficulty(question.difficulty),
  };
}

export function determineExternalQuestionQualityStatus(input: {
  autoRejected: boolean;
  automation: ExternalQuestionAutomationResult | null;
  issues: readonly ExternalQuestionIssueCode[];
}): ExternalQuestionQualityStatus {
  if (input.autoRejected) {
    return input.automation ? "REJECT_RECOMMENDED" : "AUTO_REJECTED";
  }
  if (
    input.automation?.rejectRecommended ||
    input.automation?.verificationStatus === "CONTRADICTED"
  ) {
    return "REJECT_RECOMMENDED";
  }
  if (!input.automation) return "REVIEW_REQUIRED";
  if (
    input.automation.localizationStatus !== "LOCALIZED" ||
    input.automation.verificationStatus !== "VERIFIED" ||
    input.issues.length > 0
  ) {
    return "REVIEW_REQUIRED";
  }
  return "READY_FOR_REVIEW";
}
