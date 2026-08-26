export type EvaluationAnswerFilterEntry = {
  teamname: string;
  abschnittId: number | null;
  istGespielt: boolean;
  istOffeneFrage: boolean;
  istAutomatischRichtig: boolean;
  istUnbeantwortet: boolean;
};

export type EvaluationQuestionScope =
  | "PLAYED"
  | "ALL"
  | `SECTION:${number}`;

export type EvaluationAnswerFilters = {
  scope: EvaluationQuestionScope;
  selectedTeam: string | null;
  openQuestionsOnly: boolean;
  incorrectAnswersOnly: boolean;
  includeUnanswered: boolean;
};

export const DEFAULT_EVALUATION_ANSWER_FILTERS = {
  scope: "PLAYED",
  selectedTeam: null,
  openQuestionsOnly: false,
  incorrectAnswersOnly: false,
  includeUnanswered: true,
} satisfies EvaluationAnswerFilters;

export function matchesEvaluationQuestionScope(
  entry: Pick<EvaluationAnswerFilterEntry, "abschnittId" | "istGespielt">,
  scope: EvaluationQuestionScope,
) {
  if (scope === "PLAYED") return entry.istGespielt;
  if (scope === "ALL") return true;
  return entry.abschnittId === Number(scope.slice("SECTION:".length));
}

export function filterEvaluationAnswers<
  TEntry extends EvaluationAnswerFilterEntry,
>(entries: readonly TEntry[], filters: EvaluationAnswerFilters) {
  return entries.filter((entry) => {
    if (!matchesEvaluationQuestionScope(entry, filters.scope)) return false;
    if (filters.selectedTeam && entry.teamname !== filters.selectedTeam) {
      return false;
    }
    if (filters.openQuestionsOnly && !entry.istOffeneFrage) return false;
    if (
      filters.incorrectAnswersOnly &&
      (!entry.istGespielt || entry.istAutomatischRichtig)
    ) {
      return false;
    }
    if (!filters.includeUnanswered && entry.istUnbeantwortet) return false;
    return true;
  });
}
