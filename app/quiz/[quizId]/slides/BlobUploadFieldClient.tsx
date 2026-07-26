"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  AudioPlayer,
  FileUpload,
  MediaPreview,
  VideoPlayer,
} from "@/components/ui";
import {
  getQuestionMediaFileName,
  validateQuestionMediaFile,
} from "@/app/fragen/editor/questionMedia";
import {
  buildBlobPath,
  type BlobEnvironmentPrefix,
} from "@/app/lib/blobPath";

type BlobUploadFieldClientProps = {
  label: string;
  hiddenFieldName: string;
  currentUrl?: string | null;
  zielordner: string;
  accept: string;
  environmentPrefix: BlobEnvironmentPrefix;
};

export default function BlobUploadFieldClient({
  label,
  hiddenFieldName,
  currentUrl,
  zielordner,
  accept,
  environmentPrefix,
}: BlobUploadFieldClientProps) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const mediaType = accept.includes("video") ? "VIDEO" : "AUDIO";

  async function handleUpload(file: File) {
    const validationError = validateQuestionMediaFile(file, mediaType);
    if (validationError) {
      setErrorMessage(
        validationError.code === "TOO_LARGE"
          ? `Die Datei ist zu groß (maximal ${validationError.params.size}).`
          : "Dateiformat oder Dateityp wird nicht unterstützt.",
      );
      return;
    }

    setUploading(true);
    setErrorMessage("");

    try {
      const blob = await upload(
        buildBlobPath(environmentPrefix, "media", [
          ...zielordner.split("/"),
          `${Date.now()}-${file.name}`,
        ]),
        file,
        {
          access: "public",
          handleUploadUrl: "/api/blob-upload-token",
        },
      );

      setUrl(blob.url);
    } catch (error) {
      console.error("Legacy-Medienupload im Browser fehlgeschlagen", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      setErrorMessage("Upload fehlgeschlagen. Bitte versuche es erneut.");
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
            ? "MP4, WebM oder MOV · maximal 100 MB"
            : "MP3 · maximal 20 MB"
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
