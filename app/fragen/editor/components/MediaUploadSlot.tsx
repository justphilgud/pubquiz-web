"use client";

import { useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import {
  AudioPlayer,
  FileUpload,
  ImageViewer,
  MediaPreview,
} from "@/components/ui";
import {
  getQuestionMediaFileName,
  buildQuestionMediaPathname,
  questionMediaRules,
  resolveQuestionMediaUrl,
  validateQuestionMediaFile,
} from "../questionMedia";
import type { MediaSlotKey, QuestionMediaDraft, QuestionMediaType } from "../types";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { formatMessage } from "@/app/i18n/formatMessage";

export type MediaUploadStatus = "IDLE" | "UPLOADING" | "ERROR";

type UploadTarget =
  | { target: "QUESTION"; questionId: number | null; templateId: string | null }
  | {
      target: "ANSWER";
      questionId: number | null;
      answerTarget:
        | { type: "CLASSIC"; answerId: number | null }
        | { type: "LABELED_FIELD"; answerFieldId: number | null };
    };

type MediaUploadSlotProps = {
  media: QuestionMediaDraft | null;
  mediaType: QuestionMediaType;
  slotKey: MediaSlotKey;
  uploadTarget: UploadTarget;
  environmentPrefix: BlobEnvironmentPrefix;
  label: string;
  helpText?: string;
  required?: boolean;
  compact?: boolean;
  disabled?: boolean;
  manualUploadAllowed?: boolean;
  collapsedLabel?: string;
  previewAlt: string;
  onChange: (media: QuestionMediaDraft | null) => void;
  onUploadStatusChange?: (status: MediaUploadStatus) => void;
};

type UploadState =
  | { status: "IDLE" }
  | { status: "UPLOADING" }
  | { status: "ERROR"; message: string };

function sanitizeFileName(fileName: string) {
  const sanitized = fileName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");

  return sanitized || "medium";
}

function isAuthorizationUploadFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /presigned url|authoriz|401|403|access denied/i.test(message);
}

export function MediaUploadSlot({
  media,
  mediaType,
  slotKey,
  uploadTarget,
  environmentPrefix,
  label,
  helpText,
  required = false,
  compact = false,
  disabled = false,
  manualUploadAllowed = true,
  collapsedLabel,
  previewAlt,
  onChange,
  onUploadStatusChange,
}: MediaUploadSlotProps) {
  const { messages } = useQuestionEditorMessages();
  const [isOpen, setIsOpen] = useState(Boolean(media) || !collapsedLabel);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "IDLE" });
  const rule = questionMediaRules[mediaType];
  const visibleMedia =
    media?.operation !== "REMOVE" && media?.url && media.mediaType
      ? media
      : null;
  const isIncompatible =
    visibleMedia !== null && visibleMedia.mediaType !== mediaType;

  function changeUploadState(state: UploadState) {
    setUploadState(state);
    onUploadStatusChange?.(state.status);
  }

  async function uploadFile(file: File) {
    const validationError = validateQuestionMediaFile(file, mediaType);

    if (validationError) {
      const template = validationError.code === "INVALID_EXTENSION"
        ? messages.media.invalidExtension
        : validationError.code === "INVALID_MIME"
          ? messages.media.invalidMime
          : messages.media.tooLarge;
      changeUploadState({
        status: "ERROR",
        message: formatMessage(template, validationError.params),
      });
      return;
    }

    changeUploadState({ status: "UPLOADING" });

    try {
      const pathname = buildQuestionMediaPathname(
        environmentPrefix,
        uploadTarget.target,
        mediaType,
        slotKey,
        `${crypto.randomUUID()}-${sanitizeFileName(file.name)}`,
      );
      const blob = await uploadPresigned(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/question-media-upload",
        clientPayload: JSON.stringify({ ...uploadTarget, mediaType, slotKey }),
      });

      onChange({
        slotKey,
        existingMediaId: media?.existingMediaId ?? null,
        url: blob.url,
        mediaType,
        fileName: file.name,
        mimeType: file.type,
        operation: "NEW",
        existingMediaCount: media?.existingMediaCount ?? 0,
      });
      changeUploadState({ status: "IDLE" });
    } catch (error) {
      const authorizationFailure = isAuthorizationUploadFailure(error);

      console.error("Medien-Upload im Browser fehlgeschlagen", {
        phase: authorizationFailure ? "authorization" : "transfer",
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      changeUploadState({
        status: "ERROR",
        message: authorizationFailure
          ? messages.media.authorizationError
          : messages.media.transferError,
      });
    }
  }

  function restoreRemovedMedia() {
    if (!media) {
      return;
    }

    onChange({
      ...media,
      operation:
        media.existingMediaId === null || media.mimeType ? "NEW" : "UNCHANGED",
    });
    changeUploadState({ status: "IDLE" });
  }

  if (!isOpen && !media && !required) {
    if (disabled) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-2 min-h-11 rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        {collapsedLabel}
      </button>
    );
  }

  const content = (
    <>
      <div className={compact ? "" : "mb-3"}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={compact ? "text-sm font-medium text-slate-900" : "text-lg font-semibold text-slate-950"}>
            {label}
          </h2>
          {required && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
              {messages.common.required}
            </span>
          )}
        </div>
        {helpText && <p className="mt-1 text-sm text-slate-600">{helpText}</p>}
      </div>

      {media?.blockedReason || media?.blockedReasonCode ? (
        <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{messages.media.blockedTitle}</p>
          <p className="mt-1">
            {media.blockedReasonCode
              ? formatMessage(
                  messages.media.blockedReasons[media.blockedReasonCode],
                  media.blockedReasonParams,
                )
              : media.blockedReason}
          </p>
          <p className="mt-1">{messages.media.blockedRetained}</p>
        </div>
      ) : (
        <div className={compact ? "mt-3 space-y-3" : "space-y-4"}>
          {visibleMedia && (
            <MediaPreview
              compact={compact}
              title={visibleMedia.fileName ?? getQuestionMediaFileName(visibleMedia.url!)}
              type={visibleMedia.mediaType === "IMAGE" ? messages.common.image : messages.common.audio}
            >
              {visibleMedia.mediaType === "IMAGE" ? (
                <ImageViewer
                  src={resolveQuestionMediaUrl(visibleMedia.url!)}
                  alt={previewAlt}
                />
              ) : (
                <AudioPlayer src={resolveQuestionMediaUrl(visibleMedia.url!)} />
              )}
            </MediaPreview>
          )}

          {isIncompatible && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {messages.media.incompatible}
            </p>
          )}

          {!disabled && manualUploadAllowed &&
            (media?.operation === "REMOVE" ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-3">
                <p className="text-sm text-slate-700">{messages.media.removalPending}</p>
                <button
                  type="button"
                  onClick={restoreRemovedMedia}
                  className="mt-2 min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
                >
                  {messages.media.undoRemove}
                </button>
              </div>
            ) : (
              <div
                className="flex flex-wrap items-stretch gap-2"
                onDragOver={(event) => {
                  if (!disabled) event.preventDefault();
                }}
                onDrop={(event) => {
                  if (disabled || uploadState.status === "UPLOADING") return;
                  event.preventDefault();
                  const file = event.dataTransfer.files[0];
                  if (file) void uploadFile(file);
                }}
              >
                <FileUpload
                  compact={compact}
                  label={visibleMedia ? messages.media.replace : messages.media.choose}
                  description={`${mediaType === "IMAGE" ? messages.media.imageFormats : messages.media.audioFormats} · ${formatMessage(messages.media.maximum, { size: rule.sizeLabel })}`}
                  accept={rule.accept}
                  capture={mediaType === "IMAGE" ? "environment" : undefined}
                  disabled={uploadState.status === "UPLOADING"}
                  className={compact ? "min-w-40 flex-1" : "w-full"}
                  onChange={(event) => {
                    const input = event.currentTarget;
                    const file = input.files?.[0];

                    if (file) {
                      void uploadFile(file).finally(() => {
                        input.value = "";
                      });
                    }
                  }}
                />
                {visibleMedia && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...media!, operation: "REMOVE" })}
                    disabled={uploadState.status === "UPLOADING"}
                    className="min-h-11 rounded-xl px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {messages.common.remove}
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      <div aria-live="polite" aria-atomic="true">
        {uploadState.status === "UPLOADING" && (
          <p role="status" className="mt-2 text-sm font-medium text-slate-700">
            {messages.media.uploading}
          </p>
        )}
        {uploadState.status === "ERROR" && (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {uploadState.message}
          </p>
        )}
      </div>
    </>
  );

  return compact ? (
    <div className="mt-2 border-t border-slate-100 pt-3">{content}</div>
  ) : (
    <section
      data-editor-question-media
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      {content}
    </section>
  );
}
