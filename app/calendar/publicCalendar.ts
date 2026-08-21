export const PUBLIC_CALENDAR_LANDING_PATH = "/kalender";
export const PUBLIC_CALENDAR_FEED_PATH = "/calendar/public.ics";
export const PUBLIC_CALENDAR_SUBSCRIBE_PATH = "/calendar/subscribe";

export const PUBLIC_CALENDAR_NAME = "ungegoogelt PubQuiz-Termine";

// Runtime contract: docs/architecture/quiz-runtime-contracts.md
// Subscription CTAs use stable webcal feeds, not one-time calendar downloads.
export function buildCalendarSubscriptionUrl(
  origin: string,
  feedPath: string,
) {
  const feedUrl = new URL(feedPath, origin);
  return feedUrl.toString().replace(/^https?:/, "webcal:");
}

export function buildPublicCalendarSubscriptionUrl(origin: string) {
  return buildCalendarSubscriptionUrl(origin, PUBLIC_CALENDAR_FEED_PATH);
}

export function buildEventSeriesCalendarFeedPath(eventSeriesId: number) {
  if (!Number.isInteger(eventSeriesId) || eventSeriesId <= 0) {
    throw new Error("Ungültige Eventreihen-ID für Kalenderfeed.");
  }
  return `/calendar/event-series/${eventSeriesId}.ics`;
}

export function buildEventSeriesCalendarSubscriptionUrl(
  origin: string,
  eventSeriesId: number,
) {
  return buildCalendarSubscriptionUrl(
    origin,
    buildEventSeriesCalendarFeedPath(eventSeriesId),
  );
}
