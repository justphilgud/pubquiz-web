export const PUBLIC_CALENDAR_LANDING_PATH = "/kalender";
export const PUBLIC_CALENDAR_FEED_PATH = "/calendar/public.ics";
export const PUBLIC_CALENDAR_SUBSCRIBE_PATH = "/calendar/subscribe";

export const PUBLIC_CALENDAR_NAME = "ungegoogelt PubQuiz-Termine";

export function buildPublicCalendarSubscriptionUrl(
  origin: string,
  feedPath = PUBLIC_CALENDAR_FEED_PATH,
) {
  const feedUrl = new URL(feedPath, origin);
  return feedUrl.toString().replace(/^https?:/, "webcal:");
}
