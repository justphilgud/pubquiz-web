import { readAudience } from "@/app/bingo/live/repository.server";
export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await context.params;
    return Response.json(await readAudience(key), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return Response.json({ error: "Präsentation nicht verfügbar." }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
