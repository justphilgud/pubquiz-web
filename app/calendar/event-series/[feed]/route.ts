import { getPublicEventSeriesCalendar } from "@/app/eventreihen/eventCalendar.server";

function notFoundResponse() {
  return new Response("Kalender nicht gefunden.", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ feed: string }> },
) {
  const { feed } = await params;
  const match = /^(\d+)\.ics$/.exec(feed);
  if (!match) return notFoundResponse();

  const calendar = await getPublicEventSeriesCalendar(Number(match[1]));
  if (!calendar) return notFoundResponse();

  return new Response(calendar, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Disposition": `inline; filename="eventreihe-${match[1]}.ics"`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
