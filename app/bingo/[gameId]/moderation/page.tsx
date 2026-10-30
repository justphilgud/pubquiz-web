import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { requireActor } from "@/app/lib/permissions";
import { readLive } from "../../live/repository.server";
import EventModerationPanel from "../../live/EventModerationPanel";
import ModerationPanel from "../../live/ModerationPanel";
export default async function Page({ params, searchParams }: { params: Promise<{ gameId: string }>; searchParams: Promise<{ run?: string; new?:string }> }) {
  const { actor } = await requireActor(), { gameId } = await params, query = await searchParams,run=query.run;
  const data = await readLive(actor.userId, gameId, run,query.new==="1").catch(() => notFound());
  if(data.protocol===2)return <EventModerationPanel key={data.live?.id??"new"} initial={data}/>;
  return <><AppHeader /><main className="mx-auto max-w-6xl space-y-5 px-4 py-8"><h1>{data.title}: Bingo moderieren</h1><nav className="flex gap-4"><Link href={`/bingo/${gameId}`}>Zum Spiel</Link><Link href={`/bingo/${gameId}/vorbereitung`}>Vorbereitung und Karten</Link></nav>{data.live?.state.run.status==="ENDED"&&<Link href={`/bingo/${gameId}/moderation?new=1`}>Neuen Eventdurchlauf vorbereiten</Link>}<ModerationPanel key={data.live?.id ?? "new"} initial={data} /></main></>;
}
