"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Button, FormField, Input, Select } from "@/components/ui";
import { useContentNavigationGuard } from "@/app/components/content/useContentNavigationGuard";
import { savePreparation } from "./actions";
import type { BingoCommand, PreparationView, RoundView } from "./policy";
const subscribe = () => () => {};

export default function PreparationPanel({ data }: { data: PreparationView }) {
  const router = useRouter(), [pending, start] = useTransition(), busy = useRef(false);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [message, setMessage] = useState("");
  const [dirtyRounds, setDirtyRounds] = useState<Set<string>>(new Set());
  const trackDirty = useCallback((id: string, dirty: boolean) => setDirtyRounds(current => {
    if (current.has(id) === dirty) return current;
    const next = new Set(current); if (dirty) next.add(id); else next.delete(id); return next;
  }), []);
  const base = { gameId: data.gameId, expectedSeriesId: data.seriesId, revision: data.revision };
  function run(extra: Omit<Extract<BingoCommand, { operation: "createRound" }>, keyof typeof base>) {
    if (busy.current) return;
    busy.current = true;
    start(async () => { try { const result = await savePreparation({ ...base, ...extra }); if (result.success) router.refresh(); else setMessage(result.message); } catch { setMessage("Speichern fehlgeschlagen. Bitte erneut versuchen."); } finally { busy.current = false; } });
  }
  return <div className="space-y-5">
    <p className="text-sm text-slate-600">Vorbereitung · Bingo ist noch nicht spielbar. Die geplante Ziehungszahl beendet später keine Runde automatisch.</p>
    {data.archived && <p role="status">Archivierte Eventreihe: nur Lesen und PDF-Export möglich.</p>}
    {message && <p role="alert">{message}</p>}
    <Button disabled={!ready || pending || data.archived || dirtyRounds.size > 0} onClick={() => run({ operation: "createRound" })}>Runde hinzufügen</Button>
    {!data.rounds.length && <p>Noch keine Runden vorhanden.</p>}
    {data.rounds.map(r => <RoundEditor key={`${r.id}-${data.revision}`} round={r} data={data} onDirty={trackDirty} externallyBlocked={[...dirtyRounds].some(id => id !== r.id)} />)}
    <nav aria-label="Rundenseiten" className="flex flex-wrap gap-4">{data.page > 1 && <Link href={`?page=${data.page - 1}&seriesPage=${data.seriesPage}`}>Vorherige Runden</Link>}{data.page * 25 < data.roundCount && <Link href={`?page=${data.page + 1}&seriesPage=${data.seriesPage}`}>Weitere Runden</Link>}</nav>
  </div>;
}
function RoundEditor({ round, data, onDirty, externallyBlocked }: { round: RoundView; data: PreparationView; onDirty: (id: string, dirty: boolean) => void; externallyBlocked: boolean }) {
  const router = useRouter(), [pending, start] = useTransition(), busy = useRef(false);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const initial = { label: round.label, target: String(round.target), strategy: round.strategy, issued: round.issued === null ? "" : String(round.issued) };
  const [fields, setFields] = useState(initial), [message, setMessage] = useState<{ text: string; error: boolean; field?: string } | null>(null);
  const [count, setCount] = useState("100"), [selected, setSelected] = useState("");
  const request = useRef<{ count: string; id: string } | null>(null);
  const dirty = JSON.stringify(fields) !== JSON.stringify(initial), markSaved = useContentNavigationGuard(dirty);
  useEffect(() => { onDirty(round.id, dirty); return () => onDirty(round.id, false); }, [round.id, dirty, onDirty]);
  const base = { gameId: data.gameId, expectedSeriesId: data.seriesId, revision: data.revision, roundId: round.id };
  type Extra = Record<string, unknown> & { operation: string };
  function run(extra: Extra, saving = false) {
    if (busy.current) return;
    busy.current = true; setMessage(null);
    start(async () => {
      try {
        const result = await savePreparation({ ...base, ...extra });
        if (!result.success) { setMessage({ text: result.message, error: true, field: result.field }); return; }
        if (saving) markSaved();
        router.refresh(); setMessage({ text: "Gespeichert.", error: false });
      } catch { setMessage({ text: "Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten. Bitte erneut versuchen.", error: true }); }
      finally { busy.current = false; }
    });
  }
  const blocked = !ready || pending || data.archived || externallyBlocked;
  return <section aria-labelledby={`round-${round.id}`} className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id={`round-${round.id}`} className="text-lg">{round.label}</h2><div className="flex flex-wrap gap-2"><Button disabled={blocked || dirty || round.position === 1} onClick={() => run({ operation: "moveRound", direction: -1 })}>Nach oben</Button><Button disabled={blocked || dirty} onClick={() => run({ operation: "moveRound", direction: 1 })}>Nach unten</Button><Button disabled={blocked || dirty || round.series.length > 0 || round.issued !== null || round.history.length > 0} onClick={() => { if (window.confirm("Diese unreferenzierte Runde entfernen?")) run({ operation: "removeRound" }); }}>Runde entfernen</Button></div></div>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); run({ operation: "saveRound", label: fields.label, target: Number(fields.target), strategy: fields.strategy, issued: fields.issued === "" ? null : Number(fields.issued) }, true); }}>
      <fieldset disabled={blocked} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <FormField label="Bezeichnung" htmlFor={`label-${round.id}`}><Input id={`label-${round.id}`} required maxLength={80} value={fields.label} onChange={e => setFields({ ...fields, label: e.target.value })} /></FormField>
        <FormField label="Geplante Ziehungen" htmlFor={`target-${round.id}`}><Input id={`target-${round.id}`} type="number" min={1} max={75} required list={`presets-${round.id}`} value={fields.target} onChange={e => setFields({ ...fields, target: e.target.value })} /><datalist id={`presets-${round.id}`}><option value="20" /><option value="30" /><option value="40" /></datalist></FormField>
        <FormField label="Kartenstrategie" htmlFor={`strategy-${round.id}`}><Select id={`strategy-${round.id}`} value={fields.strategy} onChange={e => setFields({ ...fields, strategy: e.target.value as "NEW" | "EXISTING" })}><option value="NEW">Neue Karten je Runde</option><option value="EXISTING">Vorhandene Karten verwenden</option></Select></FormField>
        <FormField label="Ausgegebene Karten gesamt" htmlFor={`issued-${round.id}`} hint={`Leer = nicht erfasst; 0 = ausdrücklich keine. Höchstens ${round.cardCount}.`}><Input id={`issued-${round.id}`} type="number" min={0} max={round.cardCount} value={fields.issued} onChange={e => setFields({ ...fields, issued: e.target.value })} /></FormField>
      </fieldset>
      <p className="text-xs text-slate-600">Die Gesamtmenge ist kein Nachweis, welche einzelne Karte spielberechtigt ist. PDF-Downloads verändern diese Angabe nicht.</p>
      {message && <p role={message.error ? "alert" : "status"} className={message.error ? "text-red-700" : "text-emerald-800"}>{message.text}</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={blocked}>{pending ? "Wird gespeichert …" : "Runde speichern"}</Button><Link className="inline-flex min-h-11 items-center underline" href={`/bingo/${data.gameId}`}>Abbrechen</Link></div>
    </form>
    {dirty && <p className="text-sm">Bitte die Runde zuerst speichern. Weitere Kartenaktionen sind bis dahin gesperrt.</p>}
    <fieldset disabled={blocked || dirty} className="min-w-0 space-y-3 border-t pt-3">
      <legend className="text-sm">{round.cardCount} zugeordnete Karten</legend>
      <ul className="space-y-2">{round.series.map(s => <li key={s.id} className="flex flex-wrap items-center gap-3"><Link className="break-all underline" href={`/bingo/${data.gameId}/karten?series=${s.id}`}>{s.code} · {s.count} Karten</Link><Button onClick={() => run({ operation: "detach", seriesId: s.id })}>Zuordnung entfernen</Button></li>)}</ul>
      {round.strategy === "NEW" ? <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); if (!request.current || request.current.count !== count) request.current = { count, id: crypto.randomUUID() }; run({ operation: "generate", count: Number(count), requestId: request.current.id }); }}><FormField label="Anzahl neuer Karten" htmlFor={`count-${round.id}`}><Input id={`count-${round.id}`} type="number" min={1} max={500} required value={count} onChange={e => setCount(e.target.value)} /></FormField><Button type="submit">{pending ? "Wird erzeugt …" : "Kartenserie erzeugen"}</Button><p className="w-full text-xs">Bis zu 500 Karten pro Serie. Der PDF-Export erfolgt anschließend separat.</p></form> : <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); run({ operation: "attach", seriesId: selected }); }}><FormField label="Vorhandene Serie" htmlFor={`series-${round.id}`}><Select required id={`series-${round.id}`} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Serie auswählen …</option>{data.available.filter(s => !round.series.some(l => l.id === s.id)).map(s => <option key={s.id} value={s.id}>{s.code} · {s.count} Karten · {s.designName}{s.olderDesign ? " · älteres Design" : ""}</option>)}</Select></FormField><Button type="submit">Serie zuordnen</Button></form>}
    </fieldset>
    <details><summary className="min-h-11 cursor-pointer py-3">Ausgabehistorie (letzte 20 Änderungen)</summary>{round.history.length ? <ul className="space-y-2 text-sm">{round.history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString("de-DE")} · {h.actor}: {h.before ?? "nicht erfasst"} → {h.after ?? "nicht erfasst"}</li>)}</ul> : <p>Noch keine Ausgabeänderungen.</p>}</details>
  </section>;
}
