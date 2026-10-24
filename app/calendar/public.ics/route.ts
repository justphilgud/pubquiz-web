import { getPublicQuizCalendar } from "@/app/eventreihen/eventCalendar.server";

import { parsePublicEventQuery } from "@/app/eventreihen/publicEvents";

export async function GET(request: Request) {
  let seriesIds: number[];
  try { ({ seriesIds } = parsePublicEventQuery(new URL(request.url).searchParams)); }
  catch { return new Response("Ungültiger Reihenfilter.", { status: 400, headers: { "Cache-Control": "no-store" } }); }
  const calendar = await getPublicQuizCalendar(new Date(), seriesIds);

  return new Response(calendar, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Disposition": 'inline; filename="pubquiz-termine.ics"',
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
