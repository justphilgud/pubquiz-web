"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, useSyncExternalStore } from "react";
import { Button, FormField, Input, Select } from "@/components/ui";
import { useContentNavigationGuard } from "@/app/components/content/useContentNavigationGuard";
import { saveGameDraft, createBingoDraft } from "./actions";
import { gameTypeInfo, type GameType, type GameDraftFields, type GameDraftView, type GameSeries } from "./gameDraft";
import GameTeamsPanel from './GameTeamsPanel';
import type { GameTeamsView } from './gameTeams';
const subscribeToClient = () => () => {};
export default function GameDraftForm({ type, initial, choices, canWrite, returnHref, teams, initialSeriesId }: { type: GameType; initial?: GameDraftView; choices: GameSeries[]; canWrite: boolean; returnHref: string; teams?: GameTeamsView; initialSeriesId?:number }) {
  const creationId=useRef<string|null>(null),saving=useRef(false);
  const [roundCount,setRoundCount]=useState(3);
  const [unconfirmed,setUnconfirmed]=useState(false);
  const [teamBusy,setTeamBusy] = useState(false);
  const router = useRouter();
  const ready = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const [game, setGame] = useState(initial);
  const initialFields: GameDraftFields = { seriesId: initial?.seriesId ?? initialSeriesId ?? 0, title: initial?.title ?? "", date: initial?.date ?? "", time: initial?.time ?? "" };
  const [fields, setFields] = useState(initialFields);
  const [baseline, setBaseline] = useState(JSON.stringify(initialFields));
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const markSaved = useContentNavigationGuard(canWrite && (JSON.stringify(fields) !== baseline||(!initial&&type==="BINGO"&&roundCount!==3)));
  function change<K extends keyof GameDraftFields>(key: K, value: GameDraftFields[K]) { setFields(current => ({ ...current, [key]: value })); setMessage(null); creationId.current=null; }
  return <><form onSubmit={event => { event.preventDefault(); startTransition(async () => {
    if(saving.current)return;saving.current=true;
    try {
      const result = !game&&type==="BINGO"?await createBingoDraft({...fields,roundCount,requestId:creationId.current??(creationId.current=crypto.randomUUID())}):await saveGameDraft(type, { ...fields, ...(game ? { id: game.id, updatedAt: game.updatedAt } : {}) });
      if (!result.success) { if("retryable" in result)setUnconfirmed(Boolean(result.retryable)); setMessage({ error: true, text: result.message }); return; }
      const saved = { seriesId: result.game.seriesId, title: result.game.title, date: result.game.date, time: result.game.time };
      setUnconfirmed(false); setGame(result.game); setFields(saved); setBaseline(JSON.stringify(saved)); markSaved();
      setMessage({ error: false, text: "Entwurf gespeichert." });
      if (!initial) router.replace(`${gameTypeInfo[type].path}/${result.game.id}?returnTo=${encodeURIComponent(returnHref)}`);
      router.refresh();
    } catch { if(!game&&type==="BINGO")setUnconfirmed(true); setMessage({ error: true, text: "Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten." }); } finally{saving.current=false;}
  }); }} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <p className="text-sm text-slate-600">{type === "BINGO" ? "Spielstammdaten · Karten vorbereiten und anschließend einen eigenen Durchlauf bewusst starten." : "Entwurf · Vorbereitung – dieses Spiel ist noch nicht spielbar."}</p>
    {!canWrite && <p role="status">Nur Lesezugriff. Spiele verwalten Eventmanager und Administratoren.</p>}
    <fieldset disabled={!ready || pending || teamBusy || !canWrite || unconfirmed} className="min-w-0 space-y-4">
      <FormField label="Titel" htmlFor="game-title"><Input id="game-title" name="title" required maxLength={150} value={fields.title} onChange={event => change("title", event.target.value)} /></FormField>
      {!game&&type==="BINGO"&&<FormField label="Geplante Runden" htmlFor="game-rounds" hint="Standard: 3 Runden, je 30 geplante Ziehungen. Karten anschließend bewusst vorbereiten."><Input id="game-rounds" type="number" min={1} max={10000} value={roundCount} onChange={e=>{setRoundCount(Number(e.target.value));creationId.current=null;}} required/></FormField>}
      <FormField label="Eventreihe" htmlFor="game-series"><Select id="game-series" name="seriesId" required value={fields.seriesId || ""} onChange={event => change("seriesId", Number(event.target.value))}><option value="">Eventreihe auswählen …</option>{choices.filter(c => c.canCreate || c.id === game?.seriesId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></FormField>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <FormField label="Datum (optional)" htmlFor="game-date"><Input id="game-date" type="date" name="date" min="0001-01-01" max="9999-12-31" value={fields.date} onChange={event => change("date", event.target.value)} /></FormField>
        <FormField label="Uhrzeit (optional)" htmlFor="game-time" hint="Ortszeit; eine Uhrzeit benötigt ein Datum."><Input id="game-time" type="time" name="time" step={60} value={fields.time} onChange={event => change("time", event.target.value)} /></FormField>
      </div>
    </fieldset>
    {message && <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-red-700" : "text-sm text-emerald-800"}>{message.text}</p>}
    <div className="flex flex-wrap items-center gap-3"><Link href={returnHref} className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2">{canWrite ? "Abbrechen" : "Zurück zur Übersicht"}</Link>{canWrite && <Button type="submit" disabled={!ready || pending || teamBusy}>{!ready ? "Wird geladen …" : pending ? "Wird gespeichert …" : unconfirmed ? "Dieselbe Anfrage erneut senden" : "Entwurf speichern"}</Button>}</div>
    {game && <p className="break-all text-xs text-slate-600">Spiel-ID: {game.id} · Erstellt: {new Date(game.createdAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} · Geändert: {new Date(game.updatedAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} (Europe/Berlin)</p>}
  </form>{game && teams && <GameTeamsPanel type={type} gameId={game.id} seriesId={game.seriesId} updatedAt={game.updatedAt} initial={teams} blocked={!ready || pending || JSON.stringify(fields) !== baseline} onBusy={setTeamBusy} />}</>;
}
