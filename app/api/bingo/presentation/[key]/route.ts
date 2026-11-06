import { readPollVersion, pollResponseHeaders } from "@/app/bingo/live/pollVersion.server";
import { readAudience } from "@/app/bingo/live/repository.server";
import { auth } from "@/auth";
export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  try {
    const { key } = await context.params;
    const version=await readPollVersion(Number(session.user.id),{mode:"audience",key}),headers={...pollResponseHeaders(version),"Referrer-Policy":"no-referrer"};
    if(version.etag && request.headers.get("If-None-Match")===version.etag) return new Response(null,{status:304,headers});
    return Response.json(await readAudience(Number(session.user.id), key), {headers});
  } catch { return Response.json({ error: "Präsentation nicht verfügbar." }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
