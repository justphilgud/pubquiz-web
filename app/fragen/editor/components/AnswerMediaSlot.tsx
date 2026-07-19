"use client";

import type { QuestionAnswerDraft, QuestionMediaDraft } from "../types";
import { MediaUploadSlot, type MediaUploadStatus } from "./MediaUploadSlot";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { formatMessage } from "@/app/i18n/formatMessage";

export type AnswerMediaUploadStatus = MediaUploadStatus;

type AnswerMediaSlotProps = {
  answer: QuestionAnswerDraft;
  questionId: number | null;
  pathnamePrefix: BlobEnvironmentPrefix;
  disabled: boolean;
  required?: boolean;
  onChange: (media: QuestionMediaDraft | null) => void;
  onUploadStatusChange: (status: AnswerMediaUploadStatus) => void;
};

export function AnswerMediaSlot({
  answer,
  questionId,
  pathnamePrefix,
  disabled,
  required = false,
  onChange,
  onUploadStatusChange,
}: AnswerMediaSlotProps) {
  const { messages } = useQuestionEditorMessages();
  return (
    <MediaUploadSlot
      media={answer.media}
      mediaType="IMAGE"
      slotKey="answer_image"
      uploadTarget={{
        target: "ANSWER",
        questionId,
        answerTarget: answer.fieldLabel
          ? {
              type: "LABELED_FIELD",
              answerFieldId: answer.answerFieldId ?? null,
            }
          : { type: "CLASSIC", answerId: answer.answerId ?? null },
      }}
      environmentPrefix={pathnamePrefix}
      label={messages.answers.imageLabel}
      helpText={messages.answers.imageHelp}
      compact
      required={required}
      collapsedLabel={messages.answers.addImage}
      disabled={disabled}
      previewAlt={formatMessage(messages.answers.imageAlt, {
        answer: answer.fieldLabel ?? messages.answers.answer,
      })}
      onChange={onChange}
      onUploadStatusChange={onUploadStatusChange}
    />
  );
}
