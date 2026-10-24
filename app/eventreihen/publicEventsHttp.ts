import { createHash } from "node:crypto";
import { parsePublicEventQuery, projectPublicEvents, type PublicSeriesSource } from "./publicEvents";

export const publicEventHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "If-None-Match",
  "Access-Control-Expose-Headers": "ETag",
  // Always recheck visibility; a withdrawn public series must not live in a stale cache.
  "Cache-Control": "public, max-age=0, must-revalidate",
};
export async function publicEventsResponse(
  request: Request,
  read: (options: ReturnType<typeof parsePublicEventQuery>, now: Date) => Promise<PublicSeriesSource[]>,
  now = new Date(),
) {
  let options: ReturnType<typeof parsePublicEventQuery>;
  try { options = parsePublicEventQuery(new URL(request.url).searchParams); }
  catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Ungültige Filter." },
      { status: 400, headers: { ...publicEventHeaders, "Cache-Control": "no-store" } });
  }
  const data = projectPublicEvents(await read(options, now), options, now);
  const body = JSON.stringify(data);
  const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
  const headers = { ...publicEventHeaders, ETag: etag };
  if (request.headers.get("If-None-Match")?.split(",").map((s) => s.trim().replace(/^W\//, "")).includes(etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}
