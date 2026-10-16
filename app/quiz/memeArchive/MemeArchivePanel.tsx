"use client";

/* eslint-disable @next/next/no-img-element -- Protected archive routes require cookie authentication. */

import { useCallback, useEffect, useState } from "react";
import type { MemeArchiveItem } from "./archive.server";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function MemeArchivePanel({ quizId, sessionToken }: { quizId: number; sessionToken?: string }) {
  const [items, setItems] = useState<MemeArchiveItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [availableRevisions, setAvailableRevisions] = useState<number[]>([]);
  const [selectedRevision, setSelectedRevision] = useState("");
  const [confirmation, setConfirmation] = useState<{ kind: "capture" } | { kind: "delete"; item: MemeArchiveItem } | null>(null);
  const team = sessionToken !== undefined;
  const endpoint = `/api/quiz/meme-archive?quizId=${quizId}${team ? "&team=1" : ""}`;
  const authorization = useCallback((): HeadersInit => sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}, [sessionToken]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(endpoint + (!team && selectedRevision ? `&listRevision=${selectedRevision}` : ""), { headers: authorization(), cache: "no-store" });
      if (!response.ok) throw new Error("Archiv nicht erreichbar. Bitte Anmeldung bzw. Team-Sitzung prüfen.");
      const result = await response.json() as { items: MemeArchiveItem[]; revisions: number[] };
      setItems(result.items); setAvailableRevisions(result.revisions);
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Archiv nicht erreichbar."); }
  }, [endpoint, authorization, team, selectedRevision]);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh]);
  async function download(query: string, filename: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint + query, { headers: authorization() });
      if (!response.ok) throw new Error("Download fehlgeschlagen. Bitte Bildstatus prüfen und erneut versuchen.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Download fehlgeschlagen."); }
    finally { setBusy(false); }
  }
  async function action(kind: "retry" | "delete" | "capture", item?: MemeArchiveItem, confirmed = false) {
    if (busy) return;
    if (kind !== "retry" && !confirmed) {
      setError("");
      if (kind === "delete" && item) setConfirmation({ kind, item });
      if (kind === "capture") setConfirmation({ kind });
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint + (item ? `&id=${item.id}` : ""), { method: "POST", headers: { ...authorization(), "Content-Type": "application/json" }, body: JSON.stringify({ action: kind, confirmed: kind !== "retry" }) });
      if (!response.ok) throw new Error("Aktion fehlgeschlagen. Bitte erneut versuchen; die Abgabe bleibt gespeichert.");
      await refresh();
      setConfirmation(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Aktion fehlgeschlagen."); }
    finally { setBusy(false); }
  }
  if (team && !items.length && !error) return null;
  const revisions = [...new Set(items.map(item => item.revision))];
  const buttonClass = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50";
  return <section aria-label={team ? "Meine Memes" : "Meme-Archiv"} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{team ? "Meine Memes" : "Meme-Archiv"}</h2>
      <button type="button" className={buttonClass} disabled={busy} onClick={() => void action("retry")}>Bilderstellung wiederholen</button></div>
    {error && !confirmation && <p role="alert" className="text-red-700">{error}</p>}
    {!team && <button type="button" className={buttonClass} disabled={busy} onClick={() => void action("capture")}>Bestehende bestätigte Abgaben sichern</button>}
    {!team && availableRevisions.length > 0 && <label className="block space-x-2">Durchlauf auswählen
      <select className="min-h-11 rounded border border-slate-300 bg-white p-2" value={selectedRevision} onChange={event => setSelectedRevision(event.target.value)}>
        <option value="">Neuester Durchlauf</option>{availableRevisions.map(revision => <option key={revision} value={String(revision)}>Durchlauf {revision + 1}</option>)}
      </select></label>}
    {!items.length && <p>Noch keine bestätigten Memes in diesem Archiv.</p>}
    {revisions.map(revision => <div key={revision} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Durchlauf {revision + 1}</h3>
        {!team && <button type="button" className={buttonClass} disabled={busy || items.some(item => item.revision === revision && item.status !== "READY")} onClick={() => void download(`&revision=${revision}`, `Quiz-${quizId}_Durchlauf-${revision + 1}.zip`)}>Alle Memes herunterladen</button>}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.filter(item => item.revision === revision).map(item => <article key={item.id} className="min-w-0 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        {!team && item.status === "READY" && <img src={`${endpoint}&id=${item.id}&inline=1`} alt={`Meme von ${item.teamName}`} className="aspect-[4/3] w-full object-contain" />}
        <p className="break-words font-semibold">{item.question}</p><p>{item.teamName} · {new Date(item.submittedAt).toLocaleString("de-DE")}</p>
        {item.status === "READY" ? <button type="button" className={buttonClass} disabled={busy} onClick={() => void download(`&id=${item.id}`, item.filename)}>{team ? "Mein Meme herunterladen" : "PNG herunterladen"}</button> :
          <p role="status">{item.status === "DELETING" ? "Löschung ausstehend – Löschen erneut ausführen." : item.error ?? "PNG wird erstellt. Die bestätigte Abgabe ist gespeichert."}</p>}
        {!team && <button type="button" className={`${buttonClass} ml-2`} disabled={busy} onClick={() => void action("delete", item)}>Meme löschen</button>}
      </article>)}</div>
    </div>)}
    <ConfirmDialog open={confirmation !== null}
      title={confirmation?.kind === "delete" ? "Meme dauerhaft löschen?" : "Bestätigte Abgaben sichern?"}
      danger={confirmation?.kind === "delete"}
      confirmLabel={busy ? "Wird ausgeführt …" : confirmation?.kind === "delete" ? "Dauerhaft löschen" : "Jetzt sichern"}
      onClose={() => { if (!busy) setConfirmation(null); }}
      onConfirm={() => { if (confirmation && !busy) void action(confirmation.kind, confirmation.kind === "delete" ? confirmation.item : undefined, true); }}>
      <p>{confirmation?.kind === "delete"
        ? `Meme von „${confirmation.item.teamName}“ einschließlich aller bestätigten Versionen dieser Frage in Durchlauf ${confirmation.item.revision + 1} dauerhaft löschen? Andere Team-Abgaben bleiben erhalten.`
        : "Noch vorhandene bestätigte Meme-Abgaben dieses Quiz dauerhaft sichern? Bereits gelöschte Abgaben können nicht wiederhergestellt werden."}</p>
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    </ConfirmDialog>
  </section>;
}
