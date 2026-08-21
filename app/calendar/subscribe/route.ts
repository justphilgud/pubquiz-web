import { buildPublicCalendarSubscriptionUrl } from "@/app/calendar/publicCalendar";

export function GET(request: Request) {
  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      Location: buildPublicCalendarSubscriptionUrl(new URL(request.url).origin),
    },
  });
}
