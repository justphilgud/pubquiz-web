import { prisma } from "@/app/lib/prisma";
import { readPublicEventSeries } from "@/app/eventreihen/publicEventsRepository";
import { publicEventHeaders, publicEventsResponse } from "@/app/eventreihen/publicEventsHttp";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return publicEventsResponse(request, (options, now) => readPublicEventSeries(prisma.eventreihen, options, now));
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: publicEventHeaders });
}
