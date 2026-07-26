import {
  getQuestionAnswerMode,
  type DerivedQuestionAnswerMode,
} from "@/app/fragen/questionAnswerMode";

export type QuizQuestionAnswerModeInput = {
  templateId: string | null;
  answers: readonly { isCorrect: boolean }[];
  allowFreeAnswer: boolean;
};

export type ResolvedQuizQuestionAnswerMode = {
  originalMode: DerivedQuestionAnswerMode;
  effectiveMode: DerivedQuestionAnswerMode;
  canEnableFreeAnswer: boolean;
  freeAnswerOverrideActive: boolean;
};

export function resolveQuizQuestionAnswerMode({
  templateId,
  answers,
  allowFreeAnswer,
}: QuizQuestionAnswerModeInput): ResolvedQuizQuestionAnswerMode {
  const originalMode = getQuestionAnswerMode({
    templateId,
    answers,
  });
  const canEnableFreeAnswer = originalMode === "CLOSED";
  const freeAnswerOverrideActive = canEnableFreeAnswer && allowFreeAnswer;

  return {
    originalMode,
    effectiveMode: freeAnswerOverrideActive ? "OPEN" : originalMode,
    canEnableFreeAnswer,
    freeAnswerOverrideActive,
  };
}

export function getEffectiveQuizQuestionAnswerMode(
  input: QuizQuestionAnswerModeInput,
) {
  return resolveQuizQuestionAnswerMode(input).effectiveMode;
}

export function canEnableFreeAnswer(
  question: Omit<QuizQuestionAnswerModeInput, "allowFreeAnswer">,
) {
  return resolveQuizQuestionAnswerMode({
    ...question,
    allowFreeAnswer: false,
  }).canEnableFreeAnswer;
}
