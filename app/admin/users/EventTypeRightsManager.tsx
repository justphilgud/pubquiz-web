"use client";
import { useState, useTransition } from "react";
import { getEventTypeMatrix, saveEventTypeMatrix, type EventTypeMatrixRow } from "@/app/roles/eventTypeActions";
import { EVENT_TYPES, type EventTypeRole } from "@/app/roles/eventTypes";
export function EventTypeRightsManager({ users }: { users: { id: number; name: string | null; email: string }[] }) {
  const [userId, setUserId] = useState(0);
  const [rows, setRows] = useState<EventTypeMatrixRow[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 className="text-xl font-bold">Eventartrechte</h2>
    <p className="my-3 text-sm text-slate-600">Rechte je Eventreihe und Eventart. Ohne Produktfreischaltung bleibt der Zugriff gesperrt. Erhaltene Rechte gelten nach erneuter Aktivierung wieder. Bingo und PowerPoint-Karaoke sind noch nicht als Spiele verfügbar.</p>
    <label className="block font-medium">Benutzer für Eventartrechte
      <select className="mt-2 min-h-11 w-full rounded-lg border p-2" value={userId} disabled={pending} onChange={e => {
        const id = Number(e.target.value); setUserId(id); setRows([]); setMessage("");
        if (id) startTransition(async () => { try { setRows(await getEventTypeMatrix(id)); } catch { setMessage("Rechte konnten nicht geladen werden."); } });
      }}><option value={0}>Benutzer auswählen</option>{users.map(u => <option key={u.id} value={u.id}>{u.name ?? u.email} · {u.email}</option>)}</select>
    </label>
    {userId > 0 && rows.length > 0 && <>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Eventreihe</th>{EVENT_TYPES.map(t => <th key={t.id} className="p-2">{t.label}</th>)}<th className="p-2">Eventreihe verwalten</th></tr></thead><tbody>
        {rows.map((row, index) => <tr key={row.eventSeriesId} className="border-t"><th className="p-2">{row.name}{row.archived && " (Archiviert)"}</th>
          {EVENT_TYPES.map(t => <td key={t.id} className="p-2"><span className="mb-1 block text-xs text-slate-600">{row.enabled.includes(t.id) ? "Freigeschaltet" : "Nicht freigeschaltet"}</span>
            <select aria-label={`${row.name}: ${t.label}`} className="min-h-11 rounded border p-2" disabled={pending} value={row.roles[t.id] ?? ""} onChange={e => {
              const roles = { ...row.roles }; if (e.target.value) roles[t.id] = e.target.value as EventTypeRole; else delete roles[t.id];
              setRows(rows.map((r,i) => i === index ? { ...r, roles } : r));
            }}><option value="">Kein Zugriff</option><option value="EDITOR">Editor</option><option value="EVENT_MANAGER">Eventmanager</option></select>
          </td>)}
          <td className="p-2"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label={`${row.name}: Eventreihe verwalten`} disabled={pending} checked={row.manageSeries} onChange={e => setRows(rows.map((r,i) => i === index ? { ...r, manageSeries: e.target.checked } : r))} />Erlaubt</label></td>
        </tr>)}
      </tbody></table></div>
      <p className="my-3 text-sm text-slate-600">„Eventreihe verwalten“ erlaubt Stammdaten und gemeinsames Branding, keine Benutzerverwaltung oder Produktfreischaltung und keine zusätzlichen Spielrechte.</p>
      <button type="button" disabled={pending} className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={() => startTransition(async () => {
        try { const result = await saveEventTypeMatrix(userId, rows); setMessage(result.message); } catch { setMessage("Speichern fehlgeschlagen. Bitte erneut laden."); }
      })}>{pending ? "Bitte warten …" : "Eventartrechte speichern"}</button>
    </>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
