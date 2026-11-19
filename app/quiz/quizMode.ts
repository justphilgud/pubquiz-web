export const QUIZ_MODES = {
  VARIED: "Abwechslungsreiches Quiz",
  THEMED: "Themenquiz",
} as const;

export type QuizMode = keyof typeof QUIZ_MODES;
export const DEFAULT_QUIZ_MODE: QuizMode = "VARIED";

export function isQuizMode(value: unknown): value is QuizMode {
  return value === "VARIED" || value === "THEMED";
}

export function normalizeQuizMode(value: unknown): QuizMode {
  return isQuizMode(value) ? value : DEFAULT_QUIZ_MODE;
}
