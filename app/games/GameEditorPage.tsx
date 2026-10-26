import { notFound } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { requireActor } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import { GameDraftError, gameReturnHref, gameTypeInfo, type GameType } from "./gameDraft";
import { gameSeriesForActor, readGameDraft } from "./gameDraftRepository.server";
import GameDraftForm from "./GameDraftForm";
import type { GameQuery } from "./GameListPage";
export default async function GameEditorPage({ type, id, searchParams }: { type: GameType; id?: string; searchParams: Promise<GameQuery> }) {
  const { actor } = await requireActor();
  const query = await searchParams;
  const data = id ? await readGameDraft(actor.userId, type, id).catch(error => { if (error instanceof GameDraftError) notFound(); throw error; }) : { game: undefined, choices: await prisma.$transaction(tx => gameSeriesForActor(tx, actor.userId, type)), canWrite: true };
  if (!id && !data.choices.some(c => c.canWrite)) notFound();
  const returnHref = gameReturnHref(type, typeof query.returnTo === "string" ? query.returnTo : undefined);
  return <><AppHeader /><main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8"><h1>{gameTypeInfo[type].label}: {id ? "Spiel bearbeiten" : "Spiel anlegen"}</h1><GameDraftForm key={id ?? "new"} type={type} initial={data.game} choices={data.choices} canWrite={data.canWrite} returnHref={returnHref} /></main></>;
}
