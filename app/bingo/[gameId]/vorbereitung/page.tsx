import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { requireActor } from "@/app/lib/permissions";
import { BingoPreparationError, pageNumber } from "../../preparation/policy";
import { readPreparation } from "../../preparation/readPreparation.server";
import PreparationPanel from "../../preparation/PreparationPanel";

export default async function Page({ params, searchParams }: { params: Promise<{ gameId: string }>; searchParams: Promise<{ page?: string; seriesPage?: string }> }) {
  const { actor } = await requireActor(), { gameId } = await params, q = await searchParams;
  const data = await (async () => readPreparation(actor.userId, gameId, pageNumber(q.page), pageNumber(q.seriesPage)))().catch(e => { if (e instanceof BingoPreparationError) notFound(); throw e; });
  return <><AppHeader /><main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8"><h1>{data.title}: Runden vorbereiten</h1><nav className="flex flex-wrap gap-4"><Link className="min-h-11 py-3 underline" href={`/bingo/${gameId}`}>Zum Spiel</Link><Link className="min-h-11 py-3 underline" href={`/bingo/${gameId}/karten`}>Karten und PDF</Link><Link className="min-h-11 py-3 underline" href={`/bingo/${gameId}/moderation`}>Bingo moderieren</Link></nav><PreparationPanel data={data} /><nav aria-label="Serienauswahl" className="flex flex-wrap gap-4">{data.seriesPage > 1 && <Link href={`?page=${data.page}&seriesPage=${data.seriesPage - 1}`}>Vorherige Serien</Link>}{data.seriesPage * 25 < data.seriesCount && <Link href={`?page=${data.page}&seriesPage=${data.seriesPage + 1}`}>Weitere Serien</Link>}</nav></main></>;
}
