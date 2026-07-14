import type { QuestionAnswerDraft, QuestionMediaDraft } from "../types";
import type { AnswerMediaUploadStatus } from "./AnswerMediaSlot";
import { AnswerCard } from "./AnswerCard";

type AnswersSectionProps = {
  answers: QuestionAnswerDraft[];
  questionId: number | null;
  pathnamePrefix: string;
  disabled: boolean;
  onAnswerChange: (
    answerId: string,
    changes: Partial<QuestionAnswerDraft>,
  ) => void;
  onAddAnswer: () => void;
  onRemoveAnswer: (answerId: string) => void;
  onAnswerMediaChange: (
    answerId: string,
    media: QuestionMediaDraft | null,
  ) => void;
  onAnswerMediaUploadStatusChange: (
    answerId: string,
    status: AnswerMediaUploadStatus,
  ) => void;
};

export function AnswersSection({
  answers,
  questionId,
  pathnamePrefix,
  disabled,
  onAnswerChange,
  onAddAnswer,
  onRemoveAnswer,
  onAnswerMediaChange,
  onAnswerMediaUploadStatusChange,
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
        {answers.map((answer, index) => {
          const showMedia =
            !answer.fieldGroupId ||
            answers.findIndex(
              (candidate) => candidate.fieldGroupId === answer.fieldGroupId,
            ) === index;

          return (
            <AnswerCard
              key={answer.id}
              answer={answer}
              canRemove={canRemoveAnswer}
              questionId={questionId}
              pathnamePrefix={pathnamePrefix}
              disabled={disabled}
              showMedia={showMedia}
              onChange={(changes) => onAnswerChange(answer.id, changes)}
              onMediaChange={(media) =>
                onAnswerMediaChange(answer.id, media)
              }
              onMediaUploadStatusChange={(status) =>
                onAnswerMediaUploadStatusChange(answer.id, status)
              }
              onRemove={() => onRemoveAnswer(answer.id)}
            />
          );
        })}
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
