"use client";

import { useState } from "react";

type BlobUploadFieldProps = {
  label: string;
  hiddenFieldName: string;
  currentUrl?: string | null;
  zielordner: string;
  accept: string;
};

export default function BlobUploadField({
  label,
  hiddenFieldName,
  currentUrl,
  zielordner,
  accept,
}: BlobUploadFieldProps) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("zielordner", zielordner);

      const response = await fetch("/api/upload-medium", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!result.success || !result.datei) {
        alert(result.message ?? "Upload fehlgeschlagen.");
        return;
      }

      setUrl(result.datei);
    } catch {
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
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          handleUpload(file);
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