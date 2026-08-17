import { useId, useState } from "react";
import type {
  FaceMorphPixelQuestionOptionKey,
  QuestionAnswerDraft,
  QuestionMediaDraft,
} from "../types";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import {
  AnswerMediaSlot,
  type AnswerMediaUploadStatus,
} from "./AnswerMediaSlot";
import { CharacterCount } from "./CharacterCount";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { FaceMorphPixelQuestionOption } from "./FaceMorphPixelQuestionOption";

type AnswerCardProps = {
  answer: QuestionAnswerDraft;
  canRemove: boolean;
  questionId: number | null;
  pathnamePrefix: BlobEnvironmentPrefix;
  disabled: boolean;
  showMedia: boolean;
  requireImage: boolean;
  showCorrectControl?: boolean;
  pixelQuestionOption?: {
    key: FaceMorphPixelQuestionOptionKey;
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
  onChange: (changes: Partial<QuestionAnswerDraft>) => void;
  onMediaChange: (media: QuestionMediaDraft | null) => void;
  onMediaUploadStatusChange: (status: AnswerMediaUploadStatus) => void;
  onRemove: () => void;
};

export function AnswerCard({
  answer,
  canRemove,
  questionId,
  pathnamePrefix,
  disabled,
  showMedia,
  requireImage,
  showCorrectControl = true,
  pixelQuestionOption,
  onChange,
  onMediaChange,
  onMediaUploadStatusChange,
  onRemove,
}: AnswerCardProps) {
  const { messages } = useQuestionEditorMessages();
  const fieldId = useId();
  const answerInputId = `${fieldId}-answer`;
  const additionalInfoInputId = `${fieldId}-additional-info`;
  const [isAdditionalInfoOpen, setIsAdditionalInfoOpen] = useState(
    answer.additionalInfo.length > 0,
  );

  return (
    <article className="rounded-xl border border-slate-200 p-3 sm:p-4">
      <div>
        <label
          htmlFor={answerInputId}
          className="text-sm font-medium text-slate-900"
        >
          {answer.fieldLabel ?? messages.answers.answer}
          {answer.fieldLabel && answer.isRequired === false ? ` (${messages.common.optional})` : ""}
        </label>

        <input
          id={answerInputId}
          data-editor-answer-input
          value={answer.text}
          disabled={disabled}
          maxLength={200}
          onChange={(event) => onChange({ text: event.target.value })}
          placeholder={messages.answers.inputPlaceholder}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
        />

        <CharacterCount current={answer.text.length} maximum={200} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {showCorrectControl && <label className="flex min-h-11 items-center gap-2 py-2">
          <input
            type="checkbox"
            checked={answer.isCorrect}
            disabled={disabled}
            onChange={(event) => onChange({ isCorrect: event.target.checked })}
            className="h-5 w-5"
          />

          <span className="text-sm font-medium text-slate-800">
            {messages.answers.correct}
          </span>
        </label>}

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`${messages.common.remove}: ${answer.fieldLabel ?? (answer.text.trim() || messages.answers.answer)}`}
            className="ml-auto min-h-11 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            {messages.common.remove}
          </button>
        )}
      </div>

      {showMedia && (
        <>
          <AnswerMediaSlot
            answer={answer}
            questionId={questionId}
            pathnamePrefix={pathnamePrefix}
            disabled={disabled}
            required={requireImage}
            onChange={onMediaChange}
            onUploadStatusChange={onMediaUploadStatusChange}
          />
          {pixelQuestionOption && (
            <FaceMorphPixelQuestionOption
              checked={pixelQuestionOption.checked}
              disabled={disabled}
              label={messages.answers.createPixelQuestionLater}
              onChange={pixelQuestionOption.onChange}
            />
          )}
        </>
      )}

      {showMedia && requireImage &&
        (!answer.media || answer.media.operation === "REMOVE" || !answer.media.url) && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            {messages.answers.imageRequired}
          </p>
        )}

      {isAdditionalInfoOpen ? (
        <div className="mt-2 border-t border-slate-100 pt-3">
          <div className="flex items-start justify-between gap-3">
            <label
              htmlFor={additionalInfoInputId}
              className="text-sm font-medium text-slate-900"
            >
              {messages.answers.additionalInfo}
            </label>
            <button
              type="button"
              onClick={() => setIsAdditionalInfoOpen(false)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              {messages.answers.collapse}
            </button>
          </div>

          <textarea
            id={additionalInfoInputId}
            value={answer.additionalInfo}
            disabled={disabled}
            maxLength={500}
            onChange={(event) =>
              onChange({ additionalInfo: event.target.value })
            }
            rows={2}
            placeholder={messages.answers.additionalInfoPlaceholder}
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />

          <CharacterCount
            current={answer.additionalInfo.length}
            maximum={500}
          />
          {answer.additionalInfo.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange({ additionalInfo: "" });
                setIsAdditionalInfoOpen(false);
              }}
              className="mt-1 min-h-11 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              {messages.answers.removeAdditionalInfo}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdditionalInfoOpen(true)}
          className="mt-2 min-h-11 rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {answer.additionalInfo.length > 0
            ? messages.answers.showAdditionalInfo
            : messages.answers.addAdditionalInfo}
        </button>
      )}
    </article>
  );
}
