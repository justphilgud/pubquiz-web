export type EvaluationAnswerFilterEntry = {
  teamname: string;
  istOffeneFrage: boolean;
  istAutomatischRichtig: boolean;
  istUnbeantwortet: boolean;
};

export type EvaluationAnswerFilters = {
  selectedTeam: string | null;
  openQuestionsOnly: boolean;
  incorrectAnswersOnly: boolean;
  includeUnanswered: boolean;
};

export const DEFAULT_EVALUATION_ANSWER_FILTERS = {
  selectedTeam: null,
  openQuestionsOnly: false,
  incorrectAnswersOnly: false,
  includeUnanswered: true,
} satisfies EvaluationAnswerFilters;

export function filterEvaluationAnswers<
  TEntry extends EvaluationAnswerFilterEntry,
>(entries: readonly TEntry[], filters: EvaluationAnswerFilters) {
  return entries.filter((entry) => {
    if (filters.selectedTeam && entry.teamname !== filters.selectedTeam) {
      return false;
    }
    if (filters.openQuestionsOnly && !entry.istOffeneFrage) return false;
    if (filters.incorrectAnswersOnly && entry.istAutomatischRichtig) {
      return false;
    }
    if (!filters.includeUnanswered && entry.istUnbeantwortet) return false;
    return true;
  });
}
