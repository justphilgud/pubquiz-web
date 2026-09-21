"use client";

import { useEffect, useState } from "react";

type Status = {
  environment: "preview";
  totalArtworkQuestions: number;
  imported: number;
  remaining: number;
  legacy: Array<{ questionId: number; artist: string; title: string; categories: string[] }>;
  readyToImport: boolean;
  complete: boolean;
  cleanupConfirmation: string | null;
  next: { wikidataId: string; artist: string; title: string } | null;
};

async function api(body?: object) {
  const response = await fetch("/api/admin/artwork-canon-import", body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.code ?? `HTTP_${response.status}`);
  return payload;
}

export default function ArtworkCanonImportClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Status wird geladen …");

  useEffect(() => {
    let cancelled = false;
    void api().then((payload) => {
      if (cancelled) return;
      setStatus(payload.status);
      setMessage("Preflight geladen.");
    }).catch((error) => {
      if (!cancelled) setMessage(String(error));
    });
    return () => { cancelled = true; };
  }, []);

  async function runImport() {
    setRunning(true);
    try {
      let current = status;
      while (current?.remaining) {
        const payload = await api({ action: "IMPORT_NEXT" });
        const updated: Status = payload.result.status;
        current = updated;
        setStatus(updated);
        setMessage(`${payload.result.work.artist}: ${payload.result.work.title} importiert und gelesen (${updated.imported}/199).`);
      }
      const validation = await api({ action: "VALIDATE" });
      setMessage(validation.result.ok ? "Import und vollständige Datenvalidierung erfolgreich." : `Validierung fehlgeschlagen: ${validation.result.failures.join("; ")}`);
    } catch (error) {
      setMessage(`Abbruch: ${String(error)}`);
    } finally {
      setRunning(false);
    }
  }

  async function cleanup() {
    if (!status?.cleanupConfirmation) return;
    if (!window.confirm("Nur die exakt geprüften alten E2E-Fragen #109 und #110 aus Preview löschen?")) return;
    setRunning(true);
    try {
      const payload = await api({ action: "DELETE_LEGACY_E2E", confirmation: status.cleanupConfirmation });
      setStatus(payload.status);
      setMessage("Die exakt geprüften alten E2E-Fragen 109 und 110 wurden entfernt.");
    } catch (error) {
      setMessage(`Bereinigung abgebrochen: ${String(error)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Kunstwerk-Kanon – Preview-Import</h1>
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Dieser Adapter arbeitet ausschließlich in Vercel Preview. Pro Request wird höchstens ein Werk gespeichert; Mona Lisa wird nur gelesen.</p>
      {status ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-slate-500">Kunstwerkfragen</dt><dd className="text-xl font-semibold">{status.totalArtworkQuestions}</dd></div>
            <div><dt className="text-sm text-slate-500">Kanon importiert</dt><dd className="text-xl font-semibold">{status.imported}/199</dd></div>
            <div><dt className="text-sm text-slate-500">Bereit</dt><dd>{status.readyToImport ? "Ja" : "Nein"}</dd></div>
            <div><dt className="text-sm text-slate-500">Vollständig</dt><dd>{status.complete ? "Ja" : "Nein"}</dd></div>
          </dl>
          {status.legacy.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4">
              <p className="font-medium">Import blockiert: alte E2E-Fragen vorhanden</p>
              <ul className="mt-2 list-disc pl-5 text-sm">{status.legacy.map((question) => <li key={question.questionId}>#{question.questionId}: {question.artist} – {question.title}</li>)}</ul>
              <button disabled={running} onClick={() => void cleanup()} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Exakt diese zwei E2E-Fragen löschen</button>
            </div>
          )}
          {status.next && <p className="text-sm">Nächstes Werk: {status.next.artist} – {status.next.title} ({status.next.wikidataId})</p>}
          <button disabled={running || !status.readyToImport || status.remaining === 0} onClick={() => void runImport()} className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">{running ? "Import läuft …" : "199 Werke deterministisch importieren"}</button>
        </section>
      ) : null}
      <output className="block rounded-xl bg-slate-950 p-4 text-sm text-white">{message}</output>
    </main>
  );
}
