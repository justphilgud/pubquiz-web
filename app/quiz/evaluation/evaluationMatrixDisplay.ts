import type {
  EvaluationMatrixQuestion,
  EvaluationMatrixStatus,
} from "./evaluationMatrix";

export type EvaluationMatrixFilter = "ALL" | "REVIEW" | "PROBLEMATIC";

export const evaluationMatrixStatusPresentation: Record<
  EvaluationMatrixStatus,
  {
    label: string;
    symbol: string;
    className: string;
  }
> = {
  NOT_PLAYED: {
    label: "Noch nicht gespielt",
    symbol: "○",
    className: "border-slate-300 bg-white text-slate-500",
  },
  PENDING: {
    label: "Wird berechnet",
    symbol: "…",
    className: "border-amber-300 bg-amber-50 text-amber-900",
  },
  CORRECT: {
    label: "Richtig",
    symbol: "✓",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  WRONG: {
    label: "Falsch",
    symbol: "×",
    className: "border-red-300 bg-red-50 text-red-800",
  },
  PARTIAL: {
    label: "Teilweise",
    symbol: "½",
    className: "border-amber-300 bg-amber-50 text-amber-900",
  },
  REVIEW_REQUIRED: {
    label: "Prüfen",
    symbol: "?",
    className: "border-blue-300 bg-blue-50 text-blue-900",
  },
  UNANSWERED: {
    label: "Nicht beantwortet",
    symbol: "–",
    className: "border-slate-200 bg-slate-50 text-slate-500",
  },
};

export function questionMatchesEvaluationMatrixFilter(
  question: EvaluationMatrixQuestion,
  filter: EvaluationMatrixFilter,
) {
  if (filter === "REVIEW") return question.reviewRequired > 0;
  if (filter === "PROBLEMATIC") {
    return question.wrong + question.partial + question.reviewRequired +
      question.pending > 0;
  }
  return true;
}
