import "server-only";

import { headers } from "next/headers";

import { resolveCalendarRequestOrigin } from "./calendarOrigin";

export async function getCalendarRequestOrigin() {
  return resolveCalendarRequestOrigin(await headers());
}
