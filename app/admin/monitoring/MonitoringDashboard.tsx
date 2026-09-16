"use client";

import { useEffect, useState } from "react";
import { aggregate, cardsFor, recordObservation, REFRESH_MS, STALE_MS, STATUS_LABELS, type Observation, type Severity, type Snapshot } from "./model";

const colors: Record<Severity, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-950",
  yellow: "border-amber-300 bg-amber-50 text-amber-950",
  red: "border-red-300 bg-red-50 text-red-950",
};
const labels: Record<Severity, string> = { green: "✓ In Ordnung", yellow: "! Beachten", red: "× Prüfen" };
function time(value: string | null) {
  return value ? new Date(value).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "Noch nicht beobachtet";
}

export default function MonitoringDashboard({ preview }: { preview: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [scenario, setScenario] = useState("");
  const [automatic, setAutomatic] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [history, setHistory] = useState<Observation[]>([]);
  const [lastResponseAt, setLastResponseAt] = useState<string | null>(null);
  const [requestMeasurement, setRequestMeasurement] = useState<{ ms: number; bytes: number } | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let controller: AbortController | null = null;
    let lastStarted = 0;
    async function refresh() {
      if (disposed || inFlight || document.hidden || Date.now() - lastStarted < REFRESH_MS) return;
      inFlight = true;
      lastStarted = Date.now();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 8000);
      const requestStarted = performance.now();
      try {
        const response = await fetch(`/api/admin/monitoring${scenario ? `?scenario=${encodeURIComponent(scenario)}` : ""}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("MONITORING_UNAVAILABLE");
        const body = await response.text();
        const next = JSON.parse(body) as Snapshot;
        if (!next.checkedAt || !next.db || next.simulation !== (scenario || null)) throw new Error("INVALID_MONITORING_RESPONSE");
        if (!disposed) {
          setSnapshot(next);
          setFailed(false);
          setLastResponseAt(new Date().toISOString());
          setRequestMeasurement({ ms: Math.round(performance.now() - requestStarted), bytes: new TextEncoder().encode(body).byteLength });
          setHistory(previous => recordObservation(previous, { at: new Date().toISOString(), severity: aggregate(cardsFor(next, Date.now())), source: scenario ? `Simulation: ${scenario}` : "Monitoringread" }));
        }
      } catch {
        if (!disposed) {
          setFailed(true);
          setHistory(previous => recordObservation(previous, { at: new Date().toISOString(), severity: "red", source: scenario ? "Simulation nicht erreichbar" : "Monitoringread fehlgeschlagen" }));
        }
      } finally {
        clearTimeout(timeout);
        inFlight = false;
      }
    }
    void refresh();
    const timer = window.setInterval(() => { if (automatic) void refresh(); }, REFRESH_MS);
    const onVisible = () => { if (automatic) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { disposed = true; controller?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [scenario, automatic]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const current = snapshot?.simulation === (scenario || null) ? snapshot : null;
  const cards = current ? cardsFor(current, now) : [];
  const severity: Severity = failed ? "red" : current ? aggregate(cards) : "yellow";
  const age = current ? Math.max(0, Math.floor((now - Date.parse(current.checkedAt)) / 1000)) : null;

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-900">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-medium text-slate-500">Betrieb · nur für Administratoren</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Monitoring</h1></div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} className="h-5 w-5 accent-emerald-700" />Automatische Aktualisierung</label>
    </header>
    {preview && <details className="rounded-xl border border-slate-300 bg-slate-50 p-4">
      <summary className="cursor-pointer font-medium">Preview-Abnahme · synthetische Tests</summary>
      <label className="mt-3 block text-sm">Datenquelle
        <select value={scenario} onChange={event => setScenario(event.target.value)} className="mt-2 block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 sm:max-w-md">
          <option value="">Echte Messung dieser Preview</option><option value="healthy">Test: gesunde DB / aktives Quiz</option><option value="warning">Test: langsame DB</option><option value="error">Test: Leseprüfung fehlgeschlagen</option><option value="no-quiz">Test: kein aktives Quiz</option>
        </select>
      </label><p className="mt-2 text-sm text-slate-600">Testdaten werden nicht gespeichert. Messlücken bleiben auch im gesunden Test gelb.</p>
    </details>}
    {scenario && <p role="status" className="rounded-xl border-2 border-indigo-500 bg-indigo-50 p-4 font-semibold text-indigo-950">SIMULATION · {scenario} · Keine echten Betriebswerte</p>}
    <section aria-label="Gesamtstatus" aria-live="polite" className={`rounded-2xl border p-6 ${colors[severity]}`}>
      <p className="text-sm font-medium">{current?.environment ?? "Umgebung wird geprüft"}{current && current.environment !== "production" ? " · kein Production-Nachweis" : ""}</p>
      <h2 className="mt-2 text-2xl font-semibold">{failed ? "Handlungsbedarf" : current ? STATUS_LABELS[severity] : "Prüfung läuft"}</h2>
      <p className="mt-2 text-sm">{failed ? "Monitoring nicht erreichbar. Netzwerk, Anmeldung und App prüfen. Dies belegt keinen Save- oder Datenverlust." : "Gesamtstatus der beobachtbaren Signale einschließlich Messlücken. Keine automatische Alarmierung."}</p>
      <p className="mt-4 text-sm">Zuletzt geprüft: {current ? time(current.checkedAt) : "—"}{age !== null ? ` · vor ${age} s` : ""}</p>
      <p className="mt-1 text-sm">{automatic ? "Alle 30 Sekunden bei sichtbarem Tab" : "Automatische Aktualisierung pausiert"} · {age !== null && age * 1000 > STALE_MS ? "Zustand veraltet" : "Frische bezieht sich nur auf diesen Monitor"}</p>
    </section>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(card => <section key={card.area} aria-label={card.title} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{card.title}</h2><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${colors[card.severity]}`}>{labels[card.severity]}</span></div>
        <p className="mt-4 break-words text-base font-medium">{card.summary}</p>
        {card.area === "database" && <p className="mt-2 text-sm text-slate-600">Letzte erfolgreiche Leseprüfung dieser Serverinstanz: {time(current?.db.lastSuccessAt ?? null)}</p>}
        {card.area === "live" && current?.live?.map(quiz => <div key={quiz.id} className="mt-3 border-t border-slate-100 pt-3 text-sm">
          <p className="break-words font-semibold">{quiz.name}</p><p>Laufend · Position {quiz.slide} · {quiz.registeredTeams} registrierte Teams</p><p>Aktueller Antwortlauf: {quiz.phase}</p><p className="mt-1 text-slate-600">Zustandswechsel: {time(quiz.stateChangedAt)}</p>
        </div>)}
        {card.area === "answers" && current?.live?.map(quiz => <div key={quiz.id} className="mt-3 border-t border-slate-100 pt-3 text-sm"><p className="break-words">{quiz.name}: {quiz.savedAnswers ?? "—"} Antwortdatensätze im aktuellen Lauf</p><p>Letzter gespeicherter Draft: {time(quiz.lastDraftAt)}</p></div>)}
        {card.area === "backup" && current?.backup && <div className="mt-3 space-y-2 text-sm">
          <p>Snapshot: {time(current.backup.snapshotAt)}</p><p>Alter: {Math.max(0, Math.floor((now - Date.parse(current.backup.snapshotAt)) / 3_600_000))} Stunden · Backupjob: {current.backup.durationSeconds} s</p>
          <p>Integrität / Readback: {current.backup.integrity ? "Bestätigt im Nachweis" : "Nicht bestätigt"}</p><p>Restore: {current.backup.restore === "accepted" ? "Abnahme dokumentiert" : "Daten nachvalidiert; Browserabnahme im Nachweis offen"}</p>
          <p>Beleg geprüft: {time(current.backup.checkedAt)}</p>
          <a href={current.backup.source} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-medium underline">AP9.4-Run ansehen ↗</a>
        </div>}
        {card.area === "deployment" && current?.release && <code className="mt-3 block break-all text-xs text-slate-600">{current.release}</code>}
        <details className="mt-4 text-sm text-slate-600"><summary className="cursor-pointer py-2 font-medium text-slate-800">Quelle und Einordnung</summary><p className="mt-1 leading-relaxed">{card.detail}</p></details>
      </section>)}
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Aktualität und letzte Ereignisse</h2>
      <p className="mt-2 text-sm text-slate-600">Letzte erfolgreiche Monitorantwort: {time(lastResponseAt)}. Für Moderation, Präsentation und Teilnehmer liegen keine zentralen Empfangsbestätigungen vor.</p>
      <ul className="mt-4 space-y-2 text-sm">{history.map((item, index) => <li key={`${item.at}-${index}`} className="flex flex-wrap gap-x-3 gap-y-1"><span>{time(item.at)}</span><strong>{labels[item.severity]}</strong><span>{item.source}</span></li>)}</ul>
      <p className="mt-3 text-xs text-slate-500">Höchstens 20 Statuswechsel dieses geöffneten Dashboards, nur im Arbeitsspeicher. Keine dauerhafte Fehler- oder Savehistorie.</p>
    </section>
    {current && <details className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600"><summary className="cursor-pointer font-medium text-slate-800">Messbudget und Grenzen</summary>
      <p className="mt-3">Letzte Erhebung: {current.collectionMs} ms · {current.readQueries} SELECT-Abfragen (ohne Rollenprüfung und Transaktionssteuerung). Cache: 30 s je Serverinstanz, parallele Anfragen werden dort zusammengefasst. Keine zusätzlichen Providerabfragen.</p>
      {requestMeasurement && <p className="mt-2">Letzter Browserrequest: {requestMeasurement.ms} ms · JSON-Nutzdaten: {requestMeasurement.bytes} Bytes (unkomprimiert).</p>}
      <p className="mt-2">DB-Statementlimit 1,5 s, Transaktionslimit 4 s, Poolwartebudget 1 s. Browser bricht nach 8 s ab. Diese Seite läuft in derselben Anwendung und ersetzt keine unabhängige Ausfallüberwachung.</p>
    </details>}
  </main>;
}
