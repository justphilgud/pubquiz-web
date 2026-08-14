"use client";

import { useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import {
  AudioPlayer,
  FileUpload,
  MediaPreview,
  VideoPlayer,
} from "@/components/ui";
import { getQuestionMediaFileName } from "@/app/fragen/editor/questionMedia";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import {
  buildSlideMediaUploadPathname,
  sanitizeSlideMediaFileName,
  slideMediaUploadDefinitions,
  validateSlideMediaUploadFile,
  type SlideMediaUploadSlot,
} from "@/app/quiz/slideMediaUpload";

type BlobUploadFieldClientProps = {
  label: string;
  quizId: number;
  hiddenFieldName: string;
  currentUrl?: string | null;
  slot: SlideMediaUploadSlot;
  accept: string;
  environmentPrefix: BlobEnvironmentPrefix;
};

export default function BlobUploadFieldClient({
  label,
  quizId,
  hiddenFieldName,
  currentUrl,
  slot,
  accept,
  environmentPrefix,
}: BlobUploadFieldClientProps) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const definition = slideMediaUploadDefinitions[slot];
  const mediaType = definition.mediaType;

  async function handleUpload(file: File) {
    const validationError = validateSlideMediaUploadFile(file, slot);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setUploading(true);
    setErrorMessage("");

    try {
      const blob = await uploadPresigned(
        buildSlideMediaUploadPathname(
          environmentPrefix,
          slot,
          `${crypto.randomUUID()}-${sanitizeSlideMediaFileName(file.name)}`,
        ),
        file,
        {
          access: "public",
          handleUploadUrl: "/api/question-media-upload",
          clientPayload: JSON.stringify({
            target: "QUIZ_SLIDE",
            quizId,
            slot,
          }),
        },
      );

      setUrl(blob.url);
    } catch (error) {
      const isAuthorizationFailure =
        error instanceof Error &&
        error.message.includes("Failed to retrieve the presigned URL");
      const errorCode =
        isAuthorizationFailure
          ? "SLIDE_MEDIA_UPLOAD_NOT_AUTHORIZED"
          : error instanceof Error
          ? error.message.match(/\b[A-Z][A-Z0-9_]{4,}\b/)?.[0] ??
            "SLIDE_MEDIA_UPLOAD_FAILED"
          : "SLIDE_MEDIA_UPLOAD_FAILED";
      console.error("Slide-Medienupload im Browser fehlgeschlagen", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorCode,
      });
      setErrorMessage(
        `${mediaType === "VIDEO" ? "Video" : "Audio"} konnte nicht hochgeladen werden. ` +
          (isAuthorizationFailure
            ? "Der Upload wurde vom Server nicht freigegeben."
            : "Bitte erneut versuchen."),
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-bold text-slate-700">{label}</div>

      <input
        type="hidden"
        name={hiddenFieldName}
        value={url}
        readOnly
      />

      {url && (
        <div className="mt-3">
          <MediaPreview
            compact={mediaType === "VIDEO"}
            layout={mediaType === "AUDIO" ? "audio" : "visual"}
            title={getQuestionMediaFileName(url)}
            type={mediaType === "VIDEO" ? "Video" : "Audio"}
          >
            {mediaType === "VIDEO" ? (
              <VideoPlayer src={url} />
            ) : (
              <AudioPlayer embedded src={url} />
            )}
          </MediaPreview>
        </div>
      )}

      <FileUpload
        accept={accept}
        disabled={uploading}
        className="mt-3 w-full"
        label={url ? "Datei ersetzen" : "Datei auswählen"}
        description={
          mediaType === "VIDEO"
            ? `MP4, WebM oder MOV · maximal ${definition.sizeLabel}`
            : `MP3 · maximal ${definition.sizeLabel}`
        }
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;

          void handleUpload(file);
        }}
      />

      <div aria-live="polite">
        {uploading && (
          <p className="mt-3 text-sm font-semibold text-slate-700">
            Upload läuft …
          </p>
        )}
        {errorMessage && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </p>
        )}
      </div>

      {url && (
        <button
          type="button"
          onClick={() => setUrl("")}
          className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Datei entfernen
        </button>
      )}
    </div>
  );
}
