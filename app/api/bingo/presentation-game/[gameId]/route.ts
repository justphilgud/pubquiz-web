import { auth } from "@/auth";
import { readGameAudience } from "@/app/bingo/live/repository.server";
export async function GET(_request: Request, context: { params: Promise<{ gameId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  try {
    const { gameId } = await context.params;
    return Response.json(await readGameAudience(Number(session.user.id), gameId), { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Präsentation nicht verfügbar." }, { status: 404 }); }
}
