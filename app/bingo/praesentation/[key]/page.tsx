import { notFound } from "next/navigation";
import { readAudience } from "../../live/repository.server";
import AudienceClient from "../../live/AudienceClient";
import { requireActor } from "@/app/lib/permissions";
export const metadata = { referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { actor } = await requireActor();
  const data = await readAudience(actor.userId, key).catch(() => notFound());
  return <AudienceClient initial={data} audienceKey={key} />;
}
