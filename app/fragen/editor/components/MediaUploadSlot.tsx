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
  questionMediaRules,
  resolveQuestionMediaUrl,
  validateQuestionMediaFile,
} from "../questionMedia";
import type { QuestionMediaDraft, QuestionMediaType } from "../types";

export type MediaUploadStatus = "IDLE" | "UPLOADING" | "ERROR";

type UploadTarget =
  | { target: "QUESTION"; questionId: number | null }
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
  uploadTarget: UploadTarget;
  pathnamePrefix: string;
  label: string;
  helpText?: string;
  required?: boolean;
  compact?: boolean;
  disabled?: boolean;
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

function describeUploadFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const authorizationFailure =
    /presigned url|authoriz|401|403|access denied/i.test(message);

  return authorizationFailure
    ? {
        phase: "authorization",
        message:
          "Der Upload konnte nicht autorisiert werden. Bitte prüfe die Server-Konfiguration oder versuche es später erneut.",
      }
    : {
        phase: "transfer",
        message:
          "Die Datei konnte nicht übertragen werden. Das bisherige Medium und deine Eingaben bleiben erhalten.",
      };
}

export function MediaUploadSlot({
  media,
  mediaType,
  uploadTarget,
  pathnamePrefix,
  label,
  helpText,
  required = false,
  compact = false,
  disabled = false,
  collapsedLabel,
  previewAlt,
  onChange,
  onUploadStatusChange,
}: MediaUploadSlotProps) {
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
      changeUploadState({ status: "ERROR", message: validationError });
      return;
    }

    changeUploadState({ status: "UPLOADING" });

    try {
      const directory = mediaType === "IMAGE" ? "image" : "audio";
      const pathname = `${pathnamePrefix}${uploadTarget.target.toLowerCase()}/${directory}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const blob = await uploadPresigned(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/question-media-upload",
        clientPayload: JSON.stringify({ ...uploadTarget, mediaType }),
      });

      onChange({
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
      const failure = describeUploadFailure(error);

      console.error("Medien-Upload im Browser fehlgeschlagen", {
        phase: failure.phase,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      changeUploadState({ status: "ERROR", message: failure.message });
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

  if (!isOpen && !media) {
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
              Erforderlich
            </span>
          )}
        </div>
        {helpText && <p className="mt-1 text-sm text-slate-600">{helpText}</p>}
      </div>

      {media?.blockedReason ? (
        <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Medium kann hier nicht bearbeitet werden.</p>
          <p className="mt-1">{media.blockedReason}</p>
          <p className="mt-1">Beim Speichern bleiben vorhandene Medien unverändert.</p>
        </div>
      ) : (
        <div className={compact ? "mt-3 space-y-3" : "space-y-4"}>
          {visibleMedia && (
            <MediaPreview
              compact={compact}
              title={visibleMedia.fileName ?? getQuestionMediaFileName(visibleMedia.url!)}
              type={visibleMedia.mediaType === "IMAGE" ? "Bild" : "Audio"}
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
              Das vorhandene Medium hat nicht den erforderlichen Typ.
            </p>
          )}

          {!disabled &&
            (media?.operation === "REMOVE" ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-3">
                <p className="text-sm text-slate-700">Wird beim Speichern entfernt.</p>
                <button
                  type="button"
                  onClick={restoreRemovedMedia}
                  className="mt-2 min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
                >
                  Entfernen rückgängig machen
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-stretch gap-2">
                <FileUpload
                  compact={compact}
                  label={visibleMedia ? "Medium ersetzen" : "Datei auswählen"}
                  description={`${mediaType === "IMAGE" ? "JPEG, PNG oder WebP" : "MP3, WAV oder OGG"} · maximal ${rule.sizeLabel}`}
                  accept={rule.accept}
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
                    Entfernen
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      <div aria-live="polite" aria-atomic="true">
        {uploadState.status === "UPLOADING" && (
          <p role="status" className="mt-2 text-sm font-medium text-slate-700">
            Upload läuft …
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
