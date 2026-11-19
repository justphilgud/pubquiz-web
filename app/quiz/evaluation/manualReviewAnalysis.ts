import { resolveQuizQuestionAnswerMode } from "../quizQuestionAnswerMode";
import { filterEvaluationAnswers, DEFAULT_EVALUATION_ANSWER_FILTERS } from "./evaluationAnswerFilter";
import { isMemeCaptionQuestionTemplateId, isPollQuestionTemplateId, resolveCanonicalQuestionTemplateId, questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";

/** Aggregate-only snapshot; never contains team identities or answer text. */
export type ManualReviewAggregate = {
  id: number; position: number; section: number; template: string;
  points_mode: string | null; allow_free: boolean; field_count: number;
  options: { isCorrect: boolean }[]; played: boolean;
  cells: number; answered: number; unsubmitted_drafts: number; legacy: number;
  unanswered: number; pending: number; automatic_correct: number;
  filtered: number; manual: number; unresolved: number;
  groups: { members: number; manualOrReview: number; unresolved: number; conflict: boolean }[];
};

export function analyzeManualReview(input: readonly ManualReviewAggregate[]) {
  const questions = input.filter(q => !isPollQuestionTemplateId(q.template) && !isMemeCaptionQuestionTemplateId(q.template)).map(q => {
    const mode = resolveQuizQuestionAnswerMode({ templateId: q.template, answers: q.options, allowFreeAnswer: q.allow_free }).effectiveMode;
    const open = mode === "OPEN" || (mode === "UNCLASSIFIED" && (q.options.length === 0 || q.field_count > 0));
    const entry = { teamname: "", abschnittId: q.section, istGespielt: q.played, istOffeneFrage: open, istAutomatischRichtig: false, istUnbeantwortet: false };
    const inDefault = filterEvaluationAnswers([entry], DEFAULT_EVALUATION_ANSWER_FILTERS).length > 0;
    const inOpen = filterEvaluationAnswers([entry], { ...DEFAULT_EVALUATION_ANSWER_FILTERS, openQuestionsOnly: true }).length > 0;
    const template = resolveCanonicalQuestionTemplateId(q.template);
    // NUMBER/country codes and context-dependent scores are not free-text batch candidates.
    const freeTextEligible = inOpen && template !== questionTemplateIds.pixelImage && template !== questionTemplateIds.factsYear && template !== questionTemplateIds.factsCountry && q.points_mode !== "risikofrage";
    const groups = inOpen ? q.groups : [];
    const savings = (key: "members" | "manualOrReview" | "unresolved") => groups.filter(g => !g.conflict).reduce((n, g) => n + Math.max(0, g[key] - 1), 0);
    return { ...q, open, freeTextEligible,
      defaultVisible: inDefault ? q.cells : 0,
      incorrectVisible: inDefault ? q.filtered + q.unanswered : 0,
      openAnsweredVisible: inOpen ? q.filtered : 0,
      manualEvidence: inOpen ? q.manual + q.unresolved : 0,
      exactGroups: groups.filter(g => g.members > 1).map(g => g.members),
      evidenceGroups: groups.filter(g => g.manualOrReview > 1).map(g => g.manualOrReview),
      textSavings: savings("members"), evidenceSavings: savings("manualOrReview"),
      freeTextSavings: freeTextEligible ? savings("manualOrReview") : 0,
      unresolvedSavings: freeTextEligible ? savings("unresolved") : 0,
      conflicts: groups.filter(g => g.conflict && g.manualOrReview > 1).length,
    };
  });
  const sum = (fn: (q: typeof questions[number]) => number) => questions.reduce((n, q) => n + fn(q), 0);
  return { questions, totals: {
    cells: sum(q => q.cells), defaultVisible: sum(q => q.defaultVisible),
    incorrectVisible: sum(q => q.incorrectVisible), openAnsweredVisible: sum(q => q.openAnsweredVisible),
    unanswered: sum(q => q.unanswered), pending: sum(q => q.pending),
    manual: sum(q => q.manual), unresolved: sum(q => q.unresolved),
    manualEvidence: sum(q => q.manualEvidence), textSavings: sum(q => q.textSavings),
    freeTextEvidence: sum(q => q.freeTextEligible ? q.manualEvidence : 0),
    structuredManual: sum(q => q.field_count > 0 && resolveCanonicalQuestionTemplateId(q.template) !== questionTemplateIds.pixelImage ? q.manual : 0),
    evidenceSavings: sum(q => q.evidenceSavings), freeTextSavings: sum(q => q.freeTextSavings),
    unresolvedSavings: sum(q => q.unresolvedSavings), conflicts: sum(q => q.conflicts),
  } };
}
