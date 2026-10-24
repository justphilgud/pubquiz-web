"use client";
import { useState } from "react";
import { uploadEventSeriesLogo } from "./uploadEventSeriesLogo";
import { FileUpload, ImageViewer } from "@/components/ui";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { eventSeriesLogoRule, validateEventSeriesLogoFile } from "./eventSeriesLogo";
import { saveEventSeriesLogo } from "./eventSeriesLogoActions";

export function EventSeriesLogoEditor({ id, initialUrl, canEdit, environmentPrefix }: {
  id: number; initialUrl: string | null; canEdit: boolean; environmentPrefix: BlobEnvironmentPrefix;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(next: string | null) {
    const result = await saveEventSeriesLogo(id, next, url);
    if (result.ok) setUrl(next);
    setMessage(result.message);
  }
  async function upload(file: File) {
    const error = validateEventSeriesLogoFile(file);
    if (error) { setMessage(error); return; }
    setBusy(true); setMessage("Logo wird hochgeladen …");
    try {
      await save(await uploadEventSeriesLogo(file, id, environmentPrefix));
    } catch { setMessage("Logo konnte nicht hochgeladen werden. Bitte erneut versuchen."); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await save(null); }
    catch { setMessage("Logo konnte nicht entfernt werden. Bitte erneut versuchen."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
    <h2 className="text-xl font-bold">Logo der Eventreihe</h2>
    <p className="mt-1 text-sm text-slate-600">Optional. PNG, JPEG oder WebP, maximal 5 MB. Transparenz und Seitenverhältnis bleiben erhalten. Hochgeladene Logos sind über ihre Bildadresse öffentlich abrufbar.</p>
    {url ? <div className="my-4 max-w-xs"><ImageViewer src={url} alt="Logo der Eventreihe" /></div> : <p className="my-4 text-sm text-slate-500">Kein Logo hinterlegt.</p>}
    {canEdit && <div className="flex flex-wrap items-center gap-3">
      <FileUpload label={url ? "Logo ersetzen" : "Logo hochladen"} accept={eventSeriesLogoRule.accept} disabled={busy}
        onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file); }} />
      {url && <button type="button" disabled={busy} onClick={() => void remove()} className="min-h-11 rounded-xl px-4 py-2 text-red-700 disabled:opacity-50">Logo entfernen</button>}
    </div>}
    <p role="status" aria-live="polite" className="mt-3 text-sm">{message}</p>
  </section>;
}
