import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { requireActor } from "@/app/lib/permissions";
import { readLive } from "../../live/repository.server";
import ModerationPanel from "../../live/ModerationPanel";
export default async function Page({ params, searchParams }: { params: Promise<{ gameId: string }>; searchParams: Promise<{ run?: string }> }) {
  const { actor } = await requireActor(), { gameId } = await params, { run } = await searchParams;
  const data = await readLive(actor.userId, gameId, run).catch(() => notFound());
  return <><AppHeader /><main className="mx-auto max-w-6xl space-y-5 px-4 py-8"><h1>{data.title}: Bingo moderieren</h1><nav className="flex gap-4"><Link href={`/bingo/${gameId}`}>Zum Spiel</Link><Link href={`/bingo/${gameId}/vorbereitung`}>Vorbereitung und Karten</Link></nav><ModerationPanel key={data.live?.id ?? "new"} initial={data} /></main></>;
}
