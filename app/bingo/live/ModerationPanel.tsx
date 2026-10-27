"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Input, Select, ConfirmDialog } from "@/components/ui";
import { useContentNavigationGuard } from "@/app/components/content/useContentNavigationGuard";
import { evaluateClaim } from "../core/round";
import type { Stage } from "../core/cards";
import type { LiveCommand } from "./live";
import type { AudienceView, ModerationView } from "./repository.server";
import { saveLive } from "./actions";
import BingoBoard from "./BingoBoard";
const lineName = (line: string) => line.startsWith("ROW_") ? `Zeile ${line.slice(4)}` : line.startsWith("COL_") ? `Spalte ${line.slice(4)}` : line === "DIAGONAL_DOWN" ? "Diagonale links oben → rechts unten" : "Diagonale links unten → rechts oben";

export default function ModerationPanel({ initial }: { initial: ModerationView }) {
  const router = useRouter();
  const [data, setData] = useState(initial), [connected, setConnected] = useState(true), [message, setMessage] = useState("");
  const [roundId, setRoundId] = useState(""), [number, setNumber] = useState(""), [preview, setPreview] = useState<number | null>(null);
  const [target, setTarget] = useState(""), [reason, setReason] = useState(""), [cardCode, setCardCode] = useState("");
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false), [stage, setStage] = useState<Stage>("BINGO");
  const [canRetry, setCanRetry] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; text: string; apply: () => void } | null>(null);
  const pending = useRef(false), retry = useRef<Parameters<typeof saveLive>[0] | null>(null);
  const current = useRef(initial);
  useContentNavigationGuard(Boolean(number || reason || target || cardCode || Object.values(decisionReasons).some(Boolean)));
  const runId = initial.live?.id;
  async function refresh() {
    const response = await fetch(`/api/bingo/live/${initial.gameId}${runId ? `?run=${runId}` : ""}`, { cache: "no-store" });
    if (!response.ok) throw Error("CONNECTION");
    const next = await response.json() as ModerationView;
    if (!current.current.live || next.live?.id !== current.current.live.id || (next.live?.revision ?? -1) >= current.current.live.revision) {
      current.current = next; setData(next);
    }
    setConnected(true);
  }
  useEffect(() => {
    let disposed = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/bingo/live/${initial.gameId}${runId ? `?run=${runId}` : ""}`, { cache: "no-store" });
        if (!response.ok) throw Error("CONNECTION");
        const next = await response.json() as ModerationView;
        if (!disposed) {
          if (!current.current.live || next.live?.id !== current.current.live.id || (next.live?.revision ?? -1) >= current.current.live.revision) { current.current = next; setData(next); }
          setConnected(true);
        }
      } catch { if (!disposed) setConnected(false); }
      if (!disposed) timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [initial.gameId, runId]);
  async function submit(input: Parameters<typeof saveLive>[0]) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setCanRetry(false); retry.current = input; setMessage("Wird gespeichert …");
    try {
      const result = await saveLive(input);
      if (!result.success) { setMessage(result.message); retry.current = null; return; }
      retry.current = null; setMessage("Gespeichert.");
      if (input.operation === "start" && "runId" in result) {
        router.replace(`/bingo/${data.gameId}/moderation?run=${result.runId}`);
        return;
      }
      if (input.operation === "command") {
        if (input.command.kind === "draw" || input.command.kind === "correct") { setNumber(""); setPreview(null); }
        if (input.command.kind === "correct") setReason("");
        if (input.command.kind === "decide") { const callId = input.command.callId; setDecisionReasons(current => ({ ...current, [callId]: "" })); }
        if (input.command.kind === "target") setTarget("");
        if (input.command.kind === "identify") setCardCode("");
      }
      await refresh();
    } catch { setCanRetry(true); setMessage("Antwort unklar. Bitte dieselbe Anfrage erneut senden; sie wird nicht doppelt ausgeführt."); }
    finally { pending.current = false; setBusy(false); }
  }
  function send(command: LiveCommand) {
    if (!data.live) return;
    void submit({ operation: "command", gameId: data.gameId, runId: data.live.id, revision: data.live.revision, requestId: crypto.randomUUID(), command });
  }
  const live = data.live, round = live?.state.run.rounds[0], status = live?.state.run.status;
  const board: AudienceView | null = live && round ? { id: live.id, revision: live.revision, startedAt: live.startedAt, status: live.state.run.status, label: live.round.label, target: round.plannedDraws, draws: round.draws, design: live.design, assetBase: `/api/bingo/presentation/${live.audienceKey}/assets`, claims: round.claims.map(c => ({ id: c.id, stage: c.stage, action: c.decisions.at(-1)?.action ?? null, needsReview: c.needsReview })) } : null;
  return <div className="space-y-5">
    <ConfirmDialog open={confirmation !== null} title={confirmation?.title ?? ""} onClose={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.apply; setConfirmation(null); action?.(); }}>{confirmation?.text}</ConfirmDialog>
    <p role="status">{connected ? "Verbunden" : "Verbindung unterbrochen · letzter bestätigter Stand"}{busy ? " · Speichert …" : ""}</p>
    {message && <p role="status">{message}</p>}
    <Link href={`/bingo/${data.gameId}/praesentation`} target="_blank" rel="noreferrer" className="underline">Präsentation vorab öffnen</Link>
    {canRetry && !busy && <Button onClick={() => { if (retry.current) void submit(retry.current); }}>Dieselbe Anfrage erneut senden</Button>}
    {!live || status === "ENDED" ? <section className="space-y-3 rounded-xl border p-4"><h2>Neuen Durchlauf starten</h2>
      <p>Eine vorbereitete Runde und ihre ausdrücklich zugeordneten Karten werden mit dem aktuellen Präsentationsdesign eingefroren.</p>
      <label>Vorbereitete Runde<Select value={roundId} onChange={e => setRoundId(e.target.value)}><option value="">Runde auswählen …</option>{data.rounds.filter(r => r.series.length).map(r => <option key={r.id} value={r.id}>{r.label} · {r.series.reduce((n, s) => n + s.series.card_count, 0)} Karten · {r.planned_draws} Ziehungen</option>)}</Select></label>
      {roundId && <p>Kartenserien: {data.rounds.find(r => r.id === roundId)?.series.map(s => s.series.code).join(", ")}</p>}
      {!data.rounds.some(r => r.series.length) && <p>Bitte zuerst eine Runde vorbereiten und Kartenserien zuordnen.</p>}
      <Button disabled={busy || !roundId || data.archived} onClick={() => {
        setConfirmation({ title: "Durchlauf starten?", text: "Diese Runde, ihre Kartenserien und das aktuelle Präsentationsdesign werden für den neuen Durchlauf eingefroren.", apply: () => { void submit({ operation: "start", gameId: data.gameId, roundId, requestId: crypto.randomUUID(), expectedSeriesId: data.seriesId, preparationRevision: data.preparationRevision }); } });
      }}>Durchlauf bewusst starten</Button>
    </section> : null}
    {live && round && <><section className="space-y-3 rounded-xl border p-4"><h2>{live.round.label} · {status === "RUNNING" ? "Läuft" : status === "PAUSED" ? "Pause" : "Beendet"}</h2>
      <p>{round.draws.length} / {round.plannedDraws} Ziehungen · Aktive Zeit: {Math.floor(live.elapsedMs / 60000)}:{String(Math.floor(live.elapsedMs / 1000) % 60).padStart(2, "0")} · Ausgabe: {live.round.issued === null ? "nicht erfasst" : `${live.round.issued} Karten`}</p>
      <p>Aktuelle Zahl: <strong>{round.draws.at(-1)?.number ?? "–"}</strong></p>
      <Link href={`/bingo/praesentation/${live.audienceKey}`} target="_blank" rel="noreferrer" className="underline">Präsentation öffnen</Link>
      {status !== "ENDED" && <fieldset disabled={busy || data.archived} className="space-y-3"><legend>Spiel steuern</legend>
        <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const n = Number(number); if (!/^\d+$/.test(number) || !Number.isInteger(n) || n < 1 || n > 75) { setMessage("Bitte eine ganze Zahl von 1 bis 75 eingeben."); return; } if (round.draws.some(d => d.number === n)) { setMessage("Diese Zahl wurde bereits veröffentlicht."); return; } setPreview(n); }}>
          <label>Physisch gezogene Zahl<Input inputMode="numeric" value={number} onChange={e => { setNumber(e.target.value); setPreview(null); }} /></label><Button type="submit" disabled={status !== "RUNNING"}>Zahl prüfen</Button>
        </form>
        {preview !== null && <div><p>Vorschau: <strong>{preview}</strong></p><Button disabled={status !== "RUNNING"} onClick={() => send({ kind: "draw", number: preview })}>Zahl veröffentlichen</Button></div>}
        <div className="flex flex-wrap gap-3"><Button onClick={() => send({ kind: status === "PAUSED" ? "resume" : "pause" })}>{status === "PAUSED" ? "Fortsetzen" : "Pause"}</Button><Button onClick={() => setConfirmation({ title: "Durchlauf endgültig beenden?", text: "Der gespeicherte Durchlauf kann danach nicht fortgesetzt werden. Karten und Historie bleiben erhalten.", apply: () => send({ kind: "end" }) })}>Durchlauf beenden</Button></div>
        <label>Ziehungsziel<Input inputMode="numeric" value={target} onChange={e => setTarget(e.target.value)} /></label><Button onClick={() => send({ kind: "target", number: Number(target) })}>Ziehungsziel ändern</Button>
        <label>Begründung der Korrektur<Input value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} /></label>
        <Button disabled={!round.draws.length || !number || !reason.trim()} onClick={() => setConfirmation({ title: "Letzte Zahl korrigieren?", text: "Nur die letzte Ziehung wird korrigiert. Betroffene bestätigte Gewinne werden zur Nachprüfung markiert.", apply: () => send({ kind: "correct", number: Number(number), reason }) })}>Letzte Zahl korrigieren</Button>
      </fieldset>}
      <ol aria-label="Ziehungshistorie" className="flex flex-wrap gap-3">{round.draws.map(d => <li key={d.id}>{d.position}. <strong>{d.number}</strong></li>)}</ol>
      {round.corrections.map(c => <p key={c.id}>Korrektur {c.position}: {c.before} → {c.after} · {c.reason}</p>)}
    </section>
    <section className="space-y-3 rounded-xl border p-4"><h2>Bingo-Rufe prüfen</h2><p>Geometrische Prüfung; kein Nachweis für Ausgabe, Zahlung oder Teilnahme. Den Ruf sofort erfassen, erst danach die Karte suchen.</p>
      <fieldset disabled={busy || status === "ENDED" || data.archived} className="space-y-3"><label>Gerufene Stufe<Select value={stage} onChange={e => setStage(e.target.value as Stage)}><option value="BINGO">Bingo</option><option value="DOUBLE">Doppel-Bingo</option><option value="TRIPLE">Triple-Bingo</option></Select></label>
      <Button disabled={status !== "RUNNING"} onClick={() => send({ kind: "call", stage })}>Bingo-Ruf jetzt erfassen</Button>
      <label>Kartenkennung<Input value={cardCode} placeholder="A-001, vollständige Kennung oder Karten-ID" onChange={e => setCardCode(e.target.value)} /></label>
      {live.state.calls.map(call => {
        const claim = round.claims.find(c => c.id === call.id), card = live.cards.find(c => c.id === call.cardId);
        const evaluation = claim && card ? evaluateClaim(round, claim, card) : null;
        return <article key={call.id} className="space-y-2 border-t py-3"><h3>{call.stage === "BINGO" ? "Bingo" : call.stage === "DOUBLE" ? "Doppel-Bingo" : "Triple-Bingo"} · Ruf bei Ziehung {call.throughPosition}</h3>
          {!card ? <Button onClick={() => { const found = live.cards.find(c => [c.id, c.code, c.shortCode].some(code => code.toUpperCase() === cardCode.trim().toUpperCase())); if (!found) { setMessage("Keine zugeordnete Karte gefunden."); return; } send({ kind: "identify", callId: call.id, cardId: found.id }); }}>Karte für diesen Ruf prüfen</Button> : <>
            <p>{card.shortCode} · {card.code}</p><table aria-label={`Geprüfte Karte ${card.shortCode}`}><tbody>{card.cells.map((row, r) => <tr key={r}>{row.map((n, c) => <td key={c} className="border p-2" style={{ fontWeight: n === null || round.draws.slice(0, call.throughPosition).some(d => d.number === n) ? 800 : 400 }}>{n ?? "Frei"}</td>)}</tr>)}</tbody></table>
            <p>Linien: {evaluation?.lines.map(lineName).join(", ") || "keine"} · {evaluation?.stages.includes(call.stage) ? "Gewinnstufe erfüllt" : "Gewinnstufe nicht erfüllt"}{claim?.needsReview ? " · Nachprüfung erforderlich" : ""}</p>
            <label>Begründung der Entscheidung<Input maxLength={1000} value={decisionReasons[call.id] ?? ""} onChange={e => setDecisionReasons(current => ({ ...current, [call.id]: e.target.value }))} /></label>
            <div className="flex flex-wrap gap-3">{(["CONFIRM", "REJECT", "REVOKE"] as const).map(action => <Button key={action} disabled={!decisionReasons[call.id]?.trim()} onClick={() => send({ kind: "decide", callId: call.id, action, reason: decisionReasons[call.id] })}>{action === "CONFIRM" ? "Gewinn bestätigen" : action === "REJECT" ? "Ruf ablehnen" : "Bestätigung zurücknehmen"}</Button>)}</div>
            {claim?.decisions.map(d => <p key={d.id}>{d.action === "CONFIRM" ? "Bestätigt" : d.action === "REJECT" ? "Abgelehnt" : "Zurückgenommen"} · {d.reason}</p>)}
          </>}
        </article>;
      })}</fieldset>
    </section>
    {board && <section><h2>Vorschau der Präsentation</h2><div style={{ width: "100%", aspectRatio: "16/9", overflow: "hidden", containerType: "inline-size" }}><div style={{ width: 1280, height: 720, transform: "scale(calc(100cqw / 1280px))", transformOrigin: "top left" }}><BingoBoard data={board} /></div></div></section>}
    </>}
    <section><h2>Gespeicherte Durchläufe</h2><ul>{data.runs.map(r => <li key={r.id}><Link className="underline" href={`?run=${r.id}`}>{r.startedAt} · {r.status === "ENDED" ? "Beendet" : r.status === "PAUSED" ? "Pause" : "Läuft"}</Link></li>)}</ul></section>
  </div>;
}
