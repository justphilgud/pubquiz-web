"use client";
import { useEffect, useState } from "react";
import { FileUpload, ImageViewer } from "@/components/ui";
import { eventSeriesLogoRule, validateEventSeriesLogoFile } from "./eventSeriesLogo";

export function EventSeriesLogoField({ savedUrl, draft, onChange }: {
  savedUrl: string | null; draft: File | null | undefined;
  onChange: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!draft) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPreview({ file: draft, url: reader.result });
    };
    reader.readAsDataURL(draft);
    return () => { reader.onload = null; reader.abort(); };
  }, [draft]);
  const url = draft === undefined ? savedUrl : draft === null ? null : preview?.file === draft ? preview.url : null;
  return <div className="rounded-xl border border-slate-200 p-4">
    <h3 className="font-semibold">Logo der Eventreihe</h3>
    <p className="mt-1 text-sm text-slate-600">Optional. PNG, JPEG oder WebP, maximal 5 MB. Wird mit der Eventreihe gespeichert. Hochgeladene Logos sind über ihre Bildadresse öffentlich abrufbar.</p>
    {url && <div className="my-3 max-w-xs"><ImageViewer src={url} alt="Vorschau des Reihenlogos" /></div>}
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <FileUpload label={url ? "Logo ersetzen" : "Logo auswählen"} accept={eventSeriesLogoRule.accept} onChange={(event) => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
        if (!file) return;
        const problem = validateEventSeriesLogoFile(file); setError(problem ?? "");
        if (!problem) onChange(file);
      }} />
      {(url || draft) && <button type="button" className="min-h-11 rounded-xl px-4 py-2 text-red-700" onClick={() => { onChange(null); setError(""); }}>Logo entfernen</button>}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
