"use client";
import { useState, useTransition } from "react";
import { EVENT_TYPES } from "@/app/roles/eventTypes";
import { setEventTypeEnabled } from "@/app/roles/eventTypeActions";
export function EventTypeProducts({ eventSeriesId, initialEnabled, canEdit }: { eventSeriesId: number; initialEnabled: string[]; canEdit: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-xl font-bold">Freigeschaltete Eventarten</h2>
    <p className="my-3 text-sm text-slate-600">Nur Administratoren ändern Produktfreischaltungen. Rollenzuweisungen allein schalten kein Produkt frei. Bei Deaktivierung bleiben Inhalte und Rechte erhalten; nach erneuter Aktivierung gelten die Rechte wieder. Laufende Quizze müssen zuerst regulär beendet werden.</p>
    {EVENT_TYPES.map(t => <label key={t.id} className="flex min-h-11 items-center gap-3"><input type="checkbox" disabled={!canEdit || pending} checked={enabled.includes(t.id)} onChange={e => {
      const next = e.target.checked;
      startTransition(async () => { try {
        const result = await setEventTypeEnabled(eventSeriesId, t.id, next); setMessage(result.message);
        if (result.success) setEnabled(current => next ? [...current, t.id] : current.filter(id => id !== t.id));
      } catch { setMessage("Produktfreischaltung konnte nicht gespeichert werden."); } });
    }} /><span>{t.label}{!t.implemented && " · Spielfunktion noch nicht verfügbar"}</span></label>)}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
