import { PUBLIC_CALENDAR_LANDING_PATH } from "@/app/calendar/publicCalendar";

export function GET(request: Request) {
  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      Location: new URL(PUBLIC_CALENDAR_LANDING_PATH, request.url).toString(),
    },
  });
}
