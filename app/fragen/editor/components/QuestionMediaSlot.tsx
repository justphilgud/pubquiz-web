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
import type {
  QuestionMediaDraft,
  QuestionMediaSlotConfig,
} from "../types";

type UploadState =
  | { status: "IDLE" }
  | { status: "UPLOADING" }
  | { status: "ERROR"; message: string };

type QuestionMediaSlotProps = {
  slot: QuestionMediaSlotConfig;
  media: QuestionMediaDraft | null;
  questionId: number | null;
  disabled?: boolean;
  onChange: (media: QuestionMediaDraft | null) => void;
  onUploadStatusChange?: (status: UploadState["status"]) => void;
};

function sanitizeFileName(fileName: string) {
  const sanitized = fileName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");

  return sanitized || "medium";
}

export function QuestionMediaSlot({
  slot,
  media,
  questionId,
  disabled = false,
  onChange,
  onUploadStatusChange,
}: QuestionMediaSlotProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "IDLE",
  });
  const rule = questionMediaRules[slot.allowedMediaType];
  const visibleMedia =
    media?.operation !== "REMOVE" && media?.url && media.mediaType
      ? media
      : null;
  const isIncompatible =
    visibleMedia !== null &&
    visibleMedia.mediaType !== slot.allowedMediaType;

  function changeUploadState(state: UploadState) {
    setUploadState(state);
    onUploadStatusChange?.(state.status);
  }

  async function uploadFile(file: File) {
    const validationError = validateQuestionMediaFile(
      file,
      slot.allowedMediaType,
    );

    if (validationError) {
      changeUploadState({ status: "ERROR", message: validationError });
      return;
    }

    changeUploadState({ status: "UPLOADING" });

    try {
      const directory =
        slot.allowedMediaType === "IMAGE" ? "image" : "audio";
      const pathname = `medien/fragen/editor/${directory}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const blob = await uploadPresigned(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/question-media-upload",
        clientPayload: JSON.stringify({
          questionId,
          mediaType: slot.allowedMediaType,
        }),
      });

      onChange({
        existingMediaId: media?.existingMediaId ?? null,
        url: blob.url,
        mediaType: slot.allowedMediaType,
        fileName: file.name,
        mimeType: file.type,
        operation: "NEW",
        existingMediaCount: media?.existingMediaCount ?? 0,
      });
      changeUploadState({ status: "IDLE" });
    } catch {
      changeUploadState({
        status: "ERROR",
        message:
          "Der Upload ist fehlgeschlagen. Das bisherige Medium und deine Eingaben bleiben erhalten.",
      });
    }
  }

  function markForRemoval() {
    if (!media) {
      return;
    }

    onChange({ ...media, operation: "REMOVE" });
    changeUploadState({ status: "IDLE" });
  }

  function restoreRemovedMedia() {
    if (!media) {
      return;
    }

    onChange({
      ...media,
      operation:
        media.existingMediaId === null || media.mimeType
          ? "NEW"
          : "UNCHANGED",
    });
  }

  const uploadDescription = `${
    slot.allowedMediaType === "IMAGE" ? "JPEG, PNG oder WebP" : "MP3, WAV oder OGG"
  } · maximal ${rule.sizeLabel}`;

  return (
    <section
      data-editor-question-media
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-950">
            {slot.label}
          </h2>
          {slot.required && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
              Erforderlich
            </span>
          )}
        </div>
        {slot.helpText && (
          <p className="mt-1 text-sm text-slate-600">{slot.helpText}</p>
        )}
      </div>

      {media?.blockedReason ? (
        <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Medien können hier noch nicht bearbeitet werden.</p>
          <p className="mt-1">{media.blockedReason}</p>
          <p className="mt-1">
            Beim normalen Speichern bleiben alle vorhandenen Medien unverändert.
          </p>
        </div>
      ) : media?.operation === "REMOVE" ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-4">
          <p className="text-sm text-slate-700">
            Das Medium wird erst beim Speichern der Frage entfernt.
          </p>
          <button
            type="button"
            onClick={restoreRemovedMedia}
            disabled={disabled}
            className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Entfernen rückgängig machen
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleMedia && (
            <>
              <MediaPreview
                title={
                  visibleMedia.fileName ??
                  getQuestionMediaFileName(visibleMedia.url!)
                }
                type={visibleMedia.mediaType === "IMAGE" ? "Bild" : "Audio"}
              >
                {visibleMedia.mediaType === "IMAGE" ? (
                  <ImageViewer
                    src={resolveQuestionMediaUrl(visibleMedia.url!)}
                    alt={`Vorschau: ${slot.label}`}
                  />
                ) : (
                  <AudioPlayer src={resolveQuestionMediaUrl(visibleMedia.url!)} />
                )}
              </MediaPreview>

              {isIncompatible && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  Das vorhandene Medium hat nicht den für diese Spezialfrage erforderlichen Typ.
                </p>
              )}
            </>
          )}

          <FileUpload
            label={visibleMedia ? "Medium ersetzen" : "Datei auswählen"}
            description={uploadDescription}
            accept={rule.accept}
            disabled={disabled || uploadState.status === "UPLOADING"}
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];

              if (!file) {
                return;
              }

              void uploadFile(file).finally(() => {
                input.value = "";
              });
            }}
          />

          {uploadState.status === "UPLOADING" && (
            <p role="status" className="text-sm font-medium text-slate-700">
              Upload läuft …
            </p>
          )}

          {uploadState.status === "ERROR" && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {uploadState.message}
            </p>
          )}

          {visibleMedia && (
            <button
              type="button"
              onClick={markForRemoval}
              disabled={disabled || uploadState.status === "UPLOADING"}
              className="min-h-11 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-60"
            >
              Medium entfernen
            </button>
          )}
        </div>
      )}
    </section>
  );
}
