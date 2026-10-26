import Link from "next/link";
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
  const collection = `${info.path}${selected ? `?series=${selected}` : ""}`;
  const mayCreate = choices.some(c => c.canWrite && (selected === undefined || c.id === selected));
  return <><AppHeader /><main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1>{info.label}</h1>{mayCreate && <Link href={`${info.path}/new?returnTo=${encodeURIComponent(collection)}`} className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 py-2 text-white">Spiel anlegen</Link>}</div>
    <p className="text-sm text-slate-600">Spiele als Entwurf vorbereiten und verwalten. Noch nicht spielbar.</p>
    <div className="max-w-xl"><GameSeriesFilter type={type} choices={choices} selected={selected ?? null} /></div>
    {!choices.length && <p role="status">Keine berechtigte Eventreihe mit freigeschalteter Eventart vorhanden.</p>}
    <section aria-label="Spiele" className="space-y-3">{games.map(game => <article key={game.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"><h2 className="break-words text-lg"><Link href={`${info.path}/${game.id}?returnTo=${encodeURIComponent(collection)}`} className="underline underline-offset-4">{game.title}</Link></h2><p className="mt-1 text-sm text-slate-600">{choices.find(c => c.id === game.seriesId)?.name} · Entwurf{game.date ? ` · ${game.date.split("-").reverse().join(".")}` : ""}{game.time ? ` · ${game.time} Uhr` : ""}</p></article>)}{!games.length && choices.length > 0 && <p role="status" className="rounded-xl border border-dashed p-6">Noch keine Spiele in dieser Auswahl. {mayCreate ? "Lege ein Spiel als Entwurf an." : "Eventmanager können hier Spiele vorbereiten."}</p>}</section>
  </main></>;
}
