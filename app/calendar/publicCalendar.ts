export const PUBLIC_CALENDAR_LANDING_PATH = "/kalender";
export const PUBLIC_CALENDAR_FEED_PATH = "/calendar/public.ics";
export const PUBLIC_CALENDAR_SUBSCRIBE_PATH = "/calendar/subscribe";

export const PUBLIC_CALENDAR_NAME = "ungegoogelt PubQuiz-Termine";

export function buildPublicCalendarSubscriptionUrl(origin: string) {
  const feedUrl = new URL(PUBLIC_CALENDAR_FEED_PATH, origin);
  return feedUrl.toString().replace(/^https?:/, "webcal:");
}
