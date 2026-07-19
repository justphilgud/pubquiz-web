"use client";

import type { QuestionMediaDraft, QuestionMediaSlotConfig } from "../types";
import { MediaUploadSlot, type MediaUploadStatus } from "./MediaUploadSlot";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { formatMessage } from "@/app/i18n/formatMessage";

type QuestionMediaSlotProps = {
  slot: QuestionMediaSlotConfig;
  media: QuestionMediaDraft | null;
  questionId: number | null;
  templateId: string | null;
  pathnamePrefix: BlobEnvironmentPrefix;
  disabled?: boolean;
  onChange: (media: QuestionMediaDraft | null) => void;
  onUploadStatusChange?: (status: MediaUploadStatus) => void;
};

export function QuestionMediaSlot({
  slot,
  media,
  questionId,
  templateId,
  pathnamePrefix,
  disabled = false,
  onChange,
  onUploadStatusChange,
}: QuestionMediaSlotProps) {
  const { messages } = useQuestionEditorMessages();
  return (
    <MediaUploadSlot
      media={media}
      mediaType={slot.allowedMediaType}
      slotKey={slot.key}
      uploadTarget={{ target: "QUESTION", questionId, templateId }}
      environmentPrefix={pathnamePrefix}
      label={slot.label}
      helpText={slot.helpText}
      required={slot.required}
      compact={!slot.required}
      disabled={disabled}
      manualUploadAllowed={slot.manualUploadAllowed}
      previewAlt={formatMessage(messages.media.preview, { label: slot.label })}
      onChange={onChange}
      onUploadStatusChange={onUploadStatusChange}
    />
  );
}
