"use client";

import { useSyncExternalStore, type ComponentPropsWithoutRef } from "react";
import {
  buildPublicCalendarSubscriptionUrl,
  PUBLIC_CALENDAR_FEED_PATH,
} from "./publicCalendar";

type CalendarSubscriptionLinkProps = Omit<
  ComponentPropsWithoutRef<"a">,
  "href"
> & {
  feedPath?: string;
};

const subscribeToOrigin = () => () => {};

export function CalendarSubscriptionLink({
  feedPath = PUBLIC_CALENDAR_FEED_PATH,
  children,
  ...anchorProps
}: CalendarSubscriptionLinkProps) {
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    () => window.location.origin,
    () => null,
  );
  const subscriptionUrl = origin
    ? buildPublicCalendarSubscriptionUrl(origin, feedPath)
    : undefined;

  return (
    <a
      {...anchorProps}
      href={subscriptionUrl}
      aria-disabled={subscriptionUrl ? undefined : true}
    >
      {children}
    </a>
  );
}
