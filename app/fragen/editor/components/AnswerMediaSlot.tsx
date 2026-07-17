"use client";

import type { QuestionAnswerDraft, QuestionMediaDraft } from "../types";
import { MediaUploadSlot, type MediaUploadStatus } from "./MediaUploadSlot";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";

export type AnswerMediaUploadStatus = MediaUploadStatus;

type AnswerMediaSlotProps = {
  answer: QuestionAnswerDraft;
  questionId: number | null;
  pathnamePrefix: BlobEnvironmentPrefix;
  disabled: boolean;
  onChange: (media: QuestionMediaDraft | null) => void;
  onUploadStatusChange: (status: AnswerMediaUploadStatus) => void;
};

export function AnswerMediaSlot({
  answer,
  questionId,
  pathnamePrefix,
  disabled,
  onChange,
  onUploadStatusChange,
}: AnswerMediaSlotProps) {
  return (
    <MediaUploadSlot
      media={answer.media}
      mediaType="IMAGE"
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
      label="Antwortbild"
      helpText="Optional · JPEG, PNG oder WebP · maximal 10 MB"
      compact
      collapsedLabel="Bild hinzufügen"
      disabled={disabled}
      previewAlt={`Bild zu ${answer.fieldLabel ?? "Antwort"}`}
      onChange={onChange}
      onUploadStatusChange={onUploadStatusChange}
    />
  );
}
