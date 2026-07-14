"use client";

import type { QuestionMediaDraft, QuestionMediaSlotConfig } from "../types";
import { MediaUploadSlot, type MediaUploadStatus } from "./MediaUploadSlot";

type QuestionMediaSlotProps = {
  slot: QuestionMediaSlotConfig;
  media: QuestionMediaDraft | null;
  questionId: number | null;
  pathnamePrefix: string;
  disabled?: boolean;
  onChange: (media: QuestionMediaDraft | null) => void;
  onUploadStatusChange?: (status: MediaUploadStatus) => void;
};

export function QuestionMediaSlot({
  slot,
  media,
  questionId,
  pathnamePrefix,
  disabled = false,
  onChange,
  onUploadStatusChange,
}: QuestionMediaSlotProps) {
  return (
    <MediaUploadSlot
      media={media}
      mediaType={slot.allowedMediaType}
      uploadTarget={{ target: "QUESTION", questionId }}
      pathnamePrefix={pathnamePrefix}
      label={slot.label}
      helpText={slot.helpText}
      required={slot.required}
      disabled={disabled}
      previewAlt={`Vorschau: ${slot.label}`}
      onChange={onChange}
      onUploadStatusChange={onUploadStatusChange}
    />
  );
}
