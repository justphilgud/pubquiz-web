export const CURRENT_QUIZ_ANSWER_EVALUATION_VERSION = 2;

export type EvaluationCompletenessInput = {
  auto_basis_punkte: unknown | null;
  auto_endpunkte: unknown | null;
  vergebene_punkte: unknown | null;
  bewertungsstatus: string | null;
  bewertungsquelle: string | null;
  bewertungsdetails: unknown | null;
  bewertungs_version: number | null;
};

export function isEvaluationComplete(
  answer: EvaluationCompletenessInput,
): boolean {
  return (
    answer.auto_basis_punkte !== null &&
    answer.auto_endpunkte !== null &&
    answer.vergebene_punkte !== null &&
    answer.bewertungsstatus !== null &&
    answer.bewertungsquelle !== null &&
    answer.bewertungs_version === CURRENT_QUIZ_ANSWER_EVALUATION_VERSION &&
    (answer.bewertungsquelle !== "AUTO" ||
      answer.bewertungsdetails !== null)
  );
}
