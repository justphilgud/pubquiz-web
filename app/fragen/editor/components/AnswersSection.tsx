import type { QuestionAnswerDraft } from "../types";
import { AnswerCard } from "./AnswerCard";

type AnswersSectionProps = {
  answers: QuestionAnswerDraft[];
  onAnswerChange: (
    answerId: string,
    changes: Partial<QuestionAnswerDraft>,
  ) => void;
  onAddAnswer: () => void;
  onRemoveAnswer: (answerId: string) => void;
};

export function AnswersSection({
  answers,
  onAnswerChange,
  onAddAnswer,
  onRemoveAnswer,
}: AnswersSectionProps) {
  const canRemoveAnswer = answers.length > 1;
  const correctAnswerCount = answers.filter((answer) => answer.isCorrect).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-950">Antworten</h2>
          <p className="mt-1 text-sm text-slate-600">
            Richtige und falsche Antworten bilden gemeinsam die fachliche
            Grundlage. Die Darstellung kann später im Quiz überschrieben werden.
          </p>
        </div>
        <p className="shrink-0 text-sm font-medium text-slate-700">
          {answers.length} {answers.length === 1 ? "Antwort" : "Antworten"} ·{" "}
          {correctAnswerCount} richtig
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {answers.map((answer) => (
          <AnswerCard
            key={answer.id}
            answer={answer}
            canRemove={canRemoveAnswer}
            onChange={(changes) => onAnswerChange(answer.id, changes)}
            onRemove={() => onRemoveAnswer(answer.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAddAnswer}
        className="mt-4 rounded-xl border border-slate-300 px-4 py-3 font-medium"
      >
        + Antwort hinzufügen
      </button>
    </section>
  );
}
