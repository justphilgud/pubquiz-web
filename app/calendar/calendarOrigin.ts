type CalendarRequestHeaders = {
  get(name: string): string | null;
};

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function resolveCalendarRequestOrigin(headers: CalendarRequestHeaders) {
  const host =
    firstHeaderValue(headers.get("x-forwarded-host")) ??
    firstHeaderValue(headers.get("host"));
  if (!host) throw new Error("Kalender-Origin kann ohne Host nicht aufgelöst werden.");

  const forwardedProtocol = firstHeaderValue(headers.get("x-forwarded-proto"));
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
        ? "http"
        : "https";

  return new URL(`${protocol}://${host}`).origin;
}
