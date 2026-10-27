import { notFound } from "next/navigation";
import { readAudience } from "../../live/repository.server";
import AudienceClient from "../../live/AudienceClient";
export const metadata = { referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const data = await readAudience(key).catch(() => notFound());
  return <AudienceClient initial={data} audienceKey={key} />;
}
