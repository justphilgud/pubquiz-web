import type { QuestionAnswerDraft, QuestionMediaDraft } from "../types";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import type { AnswerMediaUploadStatus } from "./AnswerMediaSlot";
import { AnswerCard } from "./AnswerCard";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { formatEditorNumber } from "@/app/i18n/formatting";

type AnswersSectionProps = {
  answers: QuestionAnswerDraft[];
  questionId: number | null;
  pathnamePrefix: BlobEnvironmentPrefix;
  disabled: boolean;
  validationError?: string | null;
  requireAnswerImages?: boolean;
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
  validationError = null,
  requireAnswerImages = false,
  onAnswerChange,
  onAddAnswer,
  onRemoveAnswer,
  onAnswerMediaChange,
  onAnswerMediaUploadStatusChange,
}: AnswersSectionProps) {
  const { locale, messages } = useQuestionEditorMessages();
  const canRemoveAnswer = answers.length > 1;
  const correctAnswerCount = answers.filter((answer) => answer.isCorrect).length;

  return (
    <section
      aria-describedby={validationError ? "answers-validation-error" : undefined}
      className={`rounded-2xl border bg-white p-3 sm:p-4 ${validationError ? "border-red-400" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-950">{messages.answers.title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {messages.answers.description}
          </p>
        </div>
        <p className="shrink-0 text-sm font-medium text-slate-700">
          {formatEditorNumber(locale, answers.length)} {answers.length === 1 ? messages.answers.answer : messages.answers.answers} ·{" "}
          {formatEditorNumber(locale, correctAnswerCount)} {messages.answers.correctShort}
        </p>
      </div>

      {validationError && (
        <p id="answers-validation-error" role="alert" className="mt-3 text-sm font-medium text-red-700">
          {validationError}
        </p>
      )}

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
              requireImage={requireAnswerImages}
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
        className="mt-4 min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3 font-medium sm:w-auto"
      >
        {messages.answers.add}
      </button>
    </section>
  );
}
