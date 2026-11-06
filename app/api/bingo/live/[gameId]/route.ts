import { readPollVersion, pollResponseHeaders } from "@/app/bingo/live/pollVersion.server";
import { auth } from "@/auth";
import { readLive } from "@/app/bingo/live/repository.server";
export async function GET(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  try {
    const { gameId } = await context.params, runId = new URL(request.url).searchParams.get("run") ?? undefined;
    const prepareNew=new URL(request.url).searchParams.get("new")==="1";
    const version=await readPollVersion(Number(session.user.id),{mode:"moderation",gameId,runId,prepareNew}),headers=pollResponseHeaders(version);
    if(version.etag && request.headers.get("If-None-Match")===version.etag) return new Response(null,{status:304,headers});
    return Response.json(await readLive(Number(session.user.id),gameId,runId,prepareNew),{headers});
  } catch { return Response.json({ error: "Kein Zugriff oder Stand nicht verfügbar." }, { status: 404 }); }
}
