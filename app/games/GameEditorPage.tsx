import Link from "next/link";
import { readGameTeams } from './gameTeamsRepository.server';
import { notFound } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { requireActor } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import { GameDraftError, gameReturnHref, gameTypeInfo, type GameType } from "./gameDraft";
import { gameSeriesForActor, readGameDraft } from "./gameDraftRepository.server";
import PreparationPanel from "@/app/bingo/preparation/PreparationPanel";
import {readPreparation} from "@/app/bingo/preparation/repository.server";
import GameDraftForm from "./GameDraftForm";
import type { GameQuery } from "./GameListPage";
export default async function GameEditorPage({ type, id, searchParams }: { type: GameType; id?: string; searchParams: Promise<GameQuery> }) {
  const { actor } = await requireActor();
  const query = await searchParams;
  const data = id ? await readGameDraft(actor.userId, type, id).catch(error => { if (error instanceof GameDraftError) notFound(); throw error; }) : { game: undefined, choices: await prisma.$transaction(tx => gameSeriesForActor(tx, actor.userId, type)), canWrite: true };
  if (!id && !data.choices.some(c => c.canCreate)) notFound();
  const teams = id ? await readGameTeams(actor.userId,type,id).catch(error=>{if(error instanceof GameDraftError)notFound();throw error;}) : undefined;
  const preparation=id&&type==="BINGO"&&data.canWrite?await readPreparation(actor.userId,id,typeof query.page==="string"?Number(query.page):1):null;
  const returnHref = gameReturnHref(type, typeof query.returnTo === "string" ? query.returnTo : undefined);
  const form=<GameDraftForm key={id ?? "new"} type={type} initial={data.game} choices={data.choices} canWrite={data.canWrite} returnHref={returnHref} teams={teams} initialSeriesId={typeof query.series==="string"&&data.choices.some(c=>c.id===Number(query.series)&&c.canCreate)?Number(query.series):undefined}/>;
  return <><AppHeader/><main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8"><div className="flex flex-wrap items-center justify-between gap-3"><h1>{id?data.game?.title:`${gameTypeInfo[type].label}: Event anlegen`}</h1>{id&&type==="BINGO"&&data.canWrite&&<nav className="flex flex-wrap gap-4"><Link className="inline-flex min-h-11 items-center underline" href={`/bingo/${id}/moderation`}>Moderation</Link><Link className="inline-flex min-h-11 items-center underline" href={`/bingo/${id}/praesentation`} target="_blank" rel="noopener">Präsentation</Link></nav>}</div>{id?<><Link href={returnHref} className="inline-flex min-h-11 items-center underline">Zurück zur Übersicht</Link><details><summary className="min-h-11 cursor-pointer py-3">Stammdaten, Design und Teams</summary><Link className="inline-flex min-h-11 items-center underline" href={`${gameTypeInfo[type].path}/${id}/design`}>Gemeinsames Design und Vorschau</Link>{form}</details>{preparation&&<PreparationPanel data={preparation}/>}</>:form}</main></>;
}
