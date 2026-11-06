import { readPollVersion, pollResponseHeaders } from "@/app/bingo/live/pollVersion.server";
import { auth } from "@/auth";
import { readGameAudience } from "@/app/bingo/live/repository.server";
export async function GET(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  try {
    const { gameId } = await context.params;
    const version=await readPollVersion(Number(session.user.id),{mode:"game",gameId}),headers={...pollResponseHeaders(version),"Referrer-Policy":"no-referrer"};
    if(version.etag && request.headers.get("If-None-Match")===version.etag) return new Response(null,{status:304,headers});
    return Response.json(await readGameAudience(Number(session.user.id), gameId), {headers});
  } catch { return Response.json({ error: "Präsentation nicht verfügbar." }, { status: 404 }); }
}
