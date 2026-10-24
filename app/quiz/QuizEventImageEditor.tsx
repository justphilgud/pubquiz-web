"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import type { BlobEnvironmentPrefix } from "@/app/lib/blobPath";
import { EventSeriesLogoField } from "@/app/eventreihen/EventSeriesLogoField";
import { buildQuizEventImagePath } from "./quizEventImage";
import { saveQuizEventImage } from "./quizEventImageActions";

export function QuizEventImageEditor({ quizId, savedUrl, seriesLogoUrl, environmentPrefix }: {
  quizId: number; savedUrl: string | null; seriesLogoUrl: string | null; environmentPrefix: BlobEnvironmentPrefix;
}) {
  const router = useRouter();
  const [currentUrl, setCurrentUrl] = useState(savedUrl);
  const [draft, setDraft] = useState<File | null | undefined>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const ownImage = draft === undefined ? Boolean(currentUrl) : Boolean(draft);
  async function save() {
    if (busyRef.current || draft === undefined) return;
    busyRef.current = true; setBusy(true); setMessage("");
    try {
      const blob = draft === null ? null : await uploadPresigned(buildQuizEventImagePath(environmentPrefix, quizId, `${crypto.randomUUID()}-${draft.name}`), draft, {
        access: "public", handleUploadUrl: "/api/question-media-upload",
        clientPayload: JSON.stringify({ target: "QUIZ_EVENT_IMAGE", quizId }),
      });
      const result = await saveQuizEventImage(quizId, blob?.url ?? null, currentUrl);
      setMessage(result.message);
      if (result.ok) { setCurrentUrl(blob?.url ?? null); setDraft(undefined); router.refresh(); }
    } catch { setMessage("Bild konnte nicht gespeichert werden. Bitte erneut versuchen."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <fieldset disabled={busy} className="space-y-2" aria-busy={busy}>
    <EventSeriesLogoField savedUrl={currentUrl} draft={draft} onChange={(value) => { setDraft(value); setMessage(""); }} title="Veranstaltungsbild" inheritedUrl={seriesLogoUrl} />
    <p className="text-sm text-slate-600">{ownImage ? "Eigenes Bild" : "Aus Eventreihe übernommen"}</p>
    <button type="button" disabled={draft === undefined} onClick={() => void save()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-semibold">{busy ? "Bild wird gespeichert …" : "Veranstaltungsbild speichern"}</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </fieldset>;
}
