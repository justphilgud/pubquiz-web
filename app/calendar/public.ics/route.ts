import { getPublicQuizCalendar } from "@/app/eventreihen/eventCalendar.server";

export async function GET() {
  const calendar = await getPublicQuizCalendar();

  return new Response(calendar, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Disposition": 'inline; filename="pubquiz-termine.ics"',
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
