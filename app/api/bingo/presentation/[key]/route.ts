import { readAudience } from "@/app/bingo/live/repository.server";
import { auth } from "@/auth";
export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  try {
    const { key } = await context.params;
    return Response.json(await readAudience(Number(session.user.id), key), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return Response.json({ error: "Präsentation nicht verfügbar." }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
