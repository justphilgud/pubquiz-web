import { readLiveAsset } from "@/app/bingo/live/repository.server";
import { auth } from "@/auth";
export async function GET(_request: Request, context: { params: Promise<{ key: string; kind: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  try {
    const { key, kind } = await context.params, asset = await readLiveAsset(Number(session.user.id), key, kind);
    return new Response(new Uint8Array(asset.bytes), { headers: { "Content-Type": asset.contentType, "Cache-Control": "private, max-age=3600", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
