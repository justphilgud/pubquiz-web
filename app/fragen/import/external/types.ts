export const EXTERNAL_QUESTION_PROVIDER = "OpenTDB" as const;
export const OPENTDB_LICENSE = "CC BY-SA 4.0" as const;
export const OPENTDB_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/" as const;

export type OpenTdbDifficulty = "easy" | "medium" | "hard";

export type ExternalQuestionIssueCode =
  | "AMBIGUOUS_QUESTION"
  | "CATEGORY_UNMAPPED"
  | "DUPLICATE_ANSWER"
  | "LANGUAGE_DEPENDENT"
  | "LOCALE_SPECIFIC"
  | "MALFORMED_CONTENT"
  | "MISSING_FACT_SOURCE"
  | "MISSING_TRANSLATION"
  | "POOR_DISTRACTOR"
  | "POTENTIAL_EXACT_DUPLICATE"
  | "POTENTIAL_SEMANTIC_DUPLICATE"
  | "TIME_SENSITIVE"
  | "UNSUPPORTED_TYPE";

export type OpenTdbApiQuestion = {
  type: string;
  difficulty: string;
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
};

export type ExternalQuestion = {
  provider: typeof EXTERNAL_QUESTION_PROVIDER;
  externalReference: string;
  license: typeof OPENTDB_LICENSE;
  licenseUrl: typeof OPENTDB_LICENSE_URL;
  originalLanguage: "en";
  category: string;
  difficulty: OpenTdbDifficulty;
  type: "multiple";
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  providerPayload: OpenTdbApiQuestion;
  contentFingerprint: string;
};

export type ExternalQuestionEnrichment = {
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  explanation: string | null;
  verificationSourceUrl: string | null;
  verificationSourceTitle: string | null;
  suggestedCategoryName: string | null;
};

export type DuplicateCandidate = {
  questionId: number;
  question: string;
  similarity: number;
  kind: "EXACT" | "SEMANTIC";
};

export type PreparedExternalQuestion = ExternalQuestion & {
  enrichment: ExternalQuestionEnrichment | null;
  mappedDifficulty: number;
  suggestedCategoryName: string;
  issues: ExternalQuestionIssueCode[];
  autoRejected: boolean;
  duplicateCandidates: DuplicateCandidate[];
};

export type ExternalQuestionProvider = {
  readonly id: typeof EXTERNAL_QUESTION_PROVIDER;
  fetchQuestions(input: {
    count: number;
    excludeExternalReferences?: readonly string[];
  }): Promise<ExternalQuestion[]>;
};

export type ExistingQuestionForDuplicateCheck = {
  questionId: number;
  question: string;
};
