import { notFound } from "next/navigation";
import { requireActor } from "@/app/lib/permissions";
import { readGameAudience } from "../../live/repository.server";
import AudienceClient from "../../live/AudienceClient";
export default async function Page({ params }: { params: Promise<{ gameId: string }> }) {
  const { actor } = await requireActor(), { gameId } = await params;
  const data = await readGameAudience(actor.userId, gameId).catch(() => notFound());
  return <AudienceClient initial={data} gameId={gameId} />;
}
