"use client";
import { useState, useTransition } from "react";
import { EventTypeSelect } from "./EventTypeSelect";
import { setEventTypeEnabled } from "@/app/roles/eventTypeActions";
export function EventTypeProducts({ eventSeriesId, initialEnabled, canEdit }: { eventSeriesId: number; initialEnabled: string[]; canEdit: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <EventTypeSelect enabled={enabled} disabled={!canEdit || pending} onToggle={(type, next) => {
      startTransition(async () => { try {
        const result = await setEventTypeEnabled(eventSeriesId, type, next); setMessage(result.message);
        if (result.success) setEnabled(current => next ? [...current, type] : current.filter(id => id !== type));
      } catch { setMessage("Produktfreischaltung konnte nicht gespeichert werden."); } });
    }} />
    <p className="mt-2 text-xs text-slate-600">Änderungen werden sofort gespeichert. Laufende Quizze schützen die Quizfreischaltung.</p>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
