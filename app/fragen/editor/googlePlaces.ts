export type GooglePlacePreview = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  rating: number | null;
  userRatingCount: number | null;
  googleMapsUri: string;
  attributionText: "Google Maps";
};

export type GoogleReviewPreview = {
  id: string;
  text: string;
  authorName: string;
  authorUri: string;
  rating: number | null;
  publishedLabel: string;
  sourceUrl: string;
  attributionText: string;
};

export type GooglePlacesErrorCode =
  | "INVALID_MAPS_URL"
  | "DISALLOWED_MAPS_HOST"
  | "SHORT_LINK_FAILED"
  | "PLACE_NOT_FOUND"
  | "MULTIPLE_PLACES"
  | "INVALID_PLACE_ID"
  | "NOT_CONFIGURED"
  | "REQUEST_FAILED"
  | "QUOTA_UNAVAILABLE"
  | "REQUEST_TIMEOUT"
  | "NO_REVIEWS"
  | "REVIEW_NOT_UNIQUE"
  | "RATE_LIMITED";

export type GooglePlaceSearchResult =
  | { ok: true; places: GooglePlacePreview[]; resolvedMapsUrl: string }
  | { ok: false; code: GooglePlacesErrorCode };

export type GoogleReviewSearchResult =
  | { ok: true; reviews: GoogleReviewPreview[] }
  | { ok: false; code: GooglePlacesErrorCode };

export function normalizeGoogleMapsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    const allowed = host === "maps.app.goo.gl" ||
      host === "maps.google.com" ||
      host === "goo.gl" && url.pathname.startsWith("/maps") ||
      (host === "google.com" || host === "www.google.com") &&
        url.pathname.startsWith("/maps");
    if (!allowed) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function extractPlaceIdFromMapsUrl(value: string): string | null {
  const normalized = normalizeGoogleMapsUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const candidate = url.searchParams.get("query_place_id") ??
    url.searchParams.get("place_id") ??
    url.pathname.split("/").find((part) => /^ChI[A-Za-z0-9_-]{10,}$/.test(part));
  return candidate?.trim() || null;
}

export function extractPlaceQueryFromMapsUrl(value: string): string | null {
  const normalized = normalizeGoogleMapsUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const placeIndex = url.pathname.split("/").indexOf("place");
  const pathParts = url.pathname.split("/");
  const candidate = placeIndex >= 0 ? pathParts[placeIndex + 1] : null;
  const raw = (
    candidate ||
    url.searchParams.get("query") ||
    url.searchParams.get("q")
  )?.replaceAll("+", " ").trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function findUniqueReviewBySourceUrl(
  reviews: readonly GoogleReviewPreview[],
  sourceUrl: string,
): GoogleReviewPreview | null {
  const normalized = normalizeGoogleMapsUrl(sourceUrl);
  if (!normalized) return null;
  const matches = reviews.filter((review) =>
    normalizeGoogleMapsUrl(review.sourceUrl) === normalized
  );
  return matches.length === 1 ? matches[0] : null;
}
