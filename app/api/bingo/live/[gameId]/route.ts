import { auth } from "@/auth";
import { readLive } from "@/app/bingo/live/repository.server";
export async function GET(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  try {
    const { gameId } = await context.params, runId = new URL(request.url).searchParams.get("run") ?? undefined;
    return Response.json(await readLive(Number(session.user.id), gameId, runId), { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Kein Zugriff oder Stand nicht verfügbar." }, { status: 404 }); }
}
