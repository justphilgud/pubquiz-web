import Link from "next/link";
import { EventRow } from "@/app/events/EventRow";
import { readBingoStatuses } from "@/app/events/statusReader.server";
import { notFound } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import GameSeriesFilter from "./GameSeriesFilter";
import { requireActor } from "@/app/lib/permissions";
import { GameDraftError, gameTypeInfo, type GameType } from "./gameDraft";
import { listGameDrafts } from "./gameDraftRepository.server";
export type GameQuery = Record<string, string | string[] | undefined>;
export default async function GameListPage({ type, searchParams, seriesId }: { type: GameType; searchParams?: Promise<GameQuery>; seriesId?: number }) {
  const { actor } = await requireActor();
  const query = await searchParams ?? {};
  if (query.series !== undefined && (typeof query.series !== "string" || !/^[1-9]\d*$/.test(query.series) || !Number.isSafeInteger(Number(query.series)))) notFound();
  const selected = seriesId ?? (query.series ? Number(query.series) : undefined);
  const { choices, games } = await listGameDrafts(actor.userId, type, selected).catch(error => { if (error instanceof GameDraftError) notFound(); throw error; });
  const info = gameTypeInfo[type];
  const statuses = type === "BINGO" ? await readBingoStatuses(games.map(g=>g.id)) : {};
  const collection = `${info.path}${selected ? `?series=${selected}` : ""}`;
  const mayCreate = choices.some(c => c.canCreate && (selected === undefined || c.id === selected));
  return <><AppHeader /><main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1>{info.label}</h1>{mayCreate && <Link href={`${info.path}/new?${selected?`series=${selected}&`:""}returnTo=${encodeURIComponent(collection)}`} className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 py-2 text-white">Event anlegen</Link>}</div>
    <p className="text-sm text-slate-600">{type === "BINGO" ? "Spiele vorbereiten, vorhandene Karten zuordnen und getrennte Bingo-Durchläufe moderieren." : "Spiele als Entwurf vorbereiten und verwalten. Noch nicht spielbar."}</p>
    <div className="max-w-xl"><GameSeriesFilter type={type} choices={choices} selected={selected ?? null} /></div>
    {!choices.length && <p role="status">Keine berechtigte Eventreihe mit freigeschalteter Eventart vorhanden.</p>}
    <section aria-label="Spiele" className="space-y-3">{games.map(game => {const manager=choices.find(c=>c.id===game.seriesId)?.canWrite;return <EventRow key={game.id} entry={{id:game.id,title:game.title,seriesName:choices.find(c=>c.id===game.seriesId)?.name??"",typeLabel:info.label,date:game.date||null,time:game.time,status:type==="BINGO"?(statuses[game.id]??"Vorbereitung"):"Nicht spielbar",prepareHref:`${info.path}/${game.id}?returnTo=${encodeURIComponent(collection)}`,...(type==="BINGO"&&manager?{moderationHref:`/bingo/${game.id}/moderation`,presentationHref:`/bingo/${game.id}/praesentation`}:{})}}/>;})}{!games.length && choices.length > 0 && <p role="status" className="rounded-xl border border-dashed p-6">Noch keine Spiele in dieser Auswahl. {mayCreate ? "Lege ein Spiel als Entwurf an." : "In dieser Auswahl können keine neuen Spiele angelegt werden."}</p>}</section>
  </main></>;
}
