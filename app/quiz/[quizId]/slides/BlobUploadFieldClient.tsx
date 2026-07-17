"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
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

  async function handleUpload(file: File) {
    setUploading(true);

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
      alert("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
      <div className="text-sm font-bold text-slate-700">{label}</div>

      <input
        type="hidden"
        name={hiddenFieldName}
        value={url}
        readOnly
      />

      <input
        type="file"
        accept={accept}
        disabled={uploading}
        className="mt-4 block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;

          void handleUpload(file);
        }}
      />

      <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm">
        {uploading
          ? "Upload läuft..."
          : url
            ? `Aktuelle Datei: ${url}`
            : "Keine Datei ausgewählt"}
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
