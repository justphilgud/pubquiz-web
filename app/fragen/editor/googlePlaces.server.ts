import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import {
  extractPlaceIdFromMapsUrl,
  extractPlaceQueryFromMapsUrl,
  normalizeGoogleMapsUrl,
  type GooglePlacePreview,
  type GooglePlacesErrorCode,
  type GoogleReviewPreview,
} from "./googlePlaces";

const DETAILS_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "rating",
  "userRatingCount",
  "googleMapsUri",
].join(",");
const REVIEW_FIELDS = [
  "id",
  "googleMapsUri",
  "reviews",
].join(",");
const MAX_REDIRECTS = 4;
const LINK_TIMEOUT_MS = 5_000;
const API_TIMEOUT_MS = 8_000;
const MAX_LINK_RESPONSE_BYTES = 64 * 1024;

type Fetch = typeof fetch;
type Lookup = typeof lookup;

export class GooglePlacesError extends Error {
  constructor(readonly code: GooglePlacesErrorCode) {
    super(code);
    this.name = "GooglePlacesError";
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 ||
      a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 ||
      a === 192 && b === 168;
  }
  const value = address.toLowerCase();
  return value === "::1" || value === "::" || value.startsWith("fc") ||
    value.startsWith("fd") || value.startsWith("fe8") ||
    value.startsWith("fe9") || value.startsWith("fea") ||
    value.startsWith("feb");
}

async function assertPublicGoogleHost(url: URL, dnsLookup: Lookup) {
  const normalized = normalizeGoogleMapsUrl(url.toString());
  if (!normalized) throw new GooglePlacesError("DISALLOWED_MAPS_HOST");
  const addresses = await dnsLookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new GooglePlacesError("DISALLOWED_MAPS_HOST");
  }
}

export async function resolveGoogleMapsUrl(
  input: string,
  dependencies: { fetch?: Fetch; lookup?: Lookup; timeoutMs?: number } = {},
): Promise<string> {
  const fetcher = dependencies.fetch ?? fetch;
  const dnsLookup = dependencies.lookup ?? lookup;
  const normalized = normalizeGoogleMapsUrl(input);
  if (!normalized) {
    let parsed: URL | null = null;
    try { parsed = new URL(input); } catch {}
    throw new GooglePlacesError(parsed?.protocol === "https:" ? "DISALLOWED_MAPS_HOST" : "INVALID_MAPS_URL");
  }

  let current = new URL(normalized);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicGoogleHost(current, dnsLookup);
    if (current.hostname !== "maps.app.goo.gl" && current.hostname !== "goo.gl") {
      return current.toString();
    }
    if (redirect === MAX_REDIRECTS) throw new GooglePlacesError("SHORT_LINK_FAILED");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      dependencies.timeoutMs ?? LINK_TIMEOUT_MS,
    );
    try {
      const response = await fetcher(current, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "text/html" },
      });
      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (contentLength > MAX_LINK_RESPONSE_BYTES) {
        throw new GooglePlacesError("SHORT_LINK_FAILED");
      }
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) {
        throw new GooglePlacesError("SHORT_LINK_FAILED");
      }
      current = new URL(location, current);
    } catch (error) {
      if (error instanceof GooglePlacesError) throw error;
      if (controller.signal.aborted) throw new GooglePlacesError("REQUEST_TIMEOUT");
      throw new GooglePlacesError("SHORT_LINK_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new GooglePlacesError("SHORT_LINK_FAILED");
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in value &&
    typeof value.text === "string") return value.text;
  return "";
}

function sanitizePlace(value: unknown): GooglePlacePreview | null {
  if (!value || typeof value !== "object") return null;
  const place = value as Record<string, unknown>;
  if (typeof place.id !== "string" || !place.id) return null;
  return {
    placeId: place.id,
    displayName: textValue(place.displayName),
    formattedAddress: textValue(place.formattedAddress),
    rating: typeof place.rating === "number" ? place.rating : null,
    userRatingCount: typeof place.userRatingCount === "number"
      ? place.userRatingCount
      : null,
    googleMapsUri: typeof place.googleMapsUri === "string"
      ? place.googleMapsUri
      : "",
    attributionText: "Google Maps",
  };
}

function sanitizeReview(value: unknown, index: number): GoogleReviewPreview | null {
  if (!value || typeof value !== "object") return null;
  const review = value as Record<string, unknown>;
  const author = review.authorAttribution &&
    typeof review.authorAttribution === "object"
    ? review.authorAttribution as Record<string, unknown>
    : {};
  const reviewText = textValue(review.originalText) || textValue(review.text);
  if (!reviewText) return null;
  const authorName = textValue(author.displayName);
  return {
    id: typeof review.name === "string" ? review.name : `google-review-${index + 1}`,
    text: reviewText,
    authorName,
    authorUri: typeof author.uri === "string" ? author.uri : "",
    rating: typeof review.rating === "number" ? review.rating : null,
    publishedLabel: textValue(review.relativePublishTimeDescription) ||
      (typeof review.publishTime === "string" ? review.publishTime.slice(0, 10) : ""),
    sourceUrl: typeof review.googleMapsUri === "string"
      ? review.googleMapsUri
      : "",
    attributionText: authorName ? `${authorName} · Google Maps` : "Google Maps",
  };
}

async function placesRequest(
  url: string,
  init: RequestInit,
  apiKey: string,
  fieldMask: string,
  fetcher: Fetch,
  timeoutMs = API_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...init.headers,
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
    });
    if (response.status === 400 || response.status === 404) {
      throw new GooglePlacesError("INVALID_PLACE_ID");
    }
    if (response.status === 403 || response.status === 429) {
      throw new GooglePlacesError("QUOTA_UNAVAILABLE");
    }
    if (!response.ok) throw new GooglePlacesError("REQUEST_FAILED");
    return await response.json();
  } catch (error) {
    if (error instanceof GooglePlacesError) throw error;
    if (controller.signal.aborted) throw new GooglePlacesError("REQUEST_TIMEOUT");
    throw new GooglePlacesError("REQUEST_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchGooglePlace(
  mapsUrl: string,
  apiKey: string,
  dependencies: {
    fetch?: Fetch;
    lookup?: Lookup;
    timeoutMs?: number;
    apiTimeoutMs?: number;
  } = {},
): Promise<{ places: GooglePlacePreview[]; resolvedMapsUrl: string }> {
  if (!apiKey) throw new GooglePlacesError("NOT_CONFIGURED");
  const fetcher = dependencies.fetch ?? fetch;
  const resolvedMapsUrl = await resolveGoogleMapsUrl(mapsUrl, dependencies);
  const placeId = extractPlaceIdFromMapsUrl(resolvedMapsUrl);
  let rawPlaces: unknown[] = [];
  if (placeId) {
    const raw = await placesRequest(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      { method: "GET" },
      apiKey,
      DETAILS_FIELDS,
      fetcher,
      dependencies.apiTimeoutMs,
    );
    rawPlaces = [raw];
  } else {
    const query = extractPlaceQueryFromMapsUrl(resolvedMapsUrl);
    if (!query) throw new GooglePlacesError("PLACE_NOT_FOUND");
    const raw = await placesRequest(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textQuery: query, pageSize: 5 }),
      },
      apiKey,
      `places.${DETAILS_FIELDS.split(",").join(",places.")}`,
      fetcher,
      dependencies.apiTimeoutMs,
    );
    rawPlaces = raw && typeof raw === "object" && "places" in raw &&
      Array.isArray(raw.places) ? raw.places : [];
  }
  const places = rawPlaces.map(sanitizePlace).filter((place): place is GooglePlacePreview => Boolean(place));
  if (places.length === 0) throw new GooglePlacesError("PLACE_NOT_FOUND");
  return { places, resolvedMapsUrl };
}

export async function loadGoogleReviews(
  placeId: string,
  apiKey: string,
  dependencies: { fetch?: Fetch; apiTimeoutMs?: number } = {},
): Promise<GoogleReviewPreview[]> {
  if (!apiKey) throw new GooglePlacesError("NOT_CONFIGURED");
  if (!placeId.trim()) throw new GooglePlacesError("INVALID_PLACE_ID");
  const raw = await placesRequest(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId.trim())}`,
    { method: "GET" },
    apiKey,
    REVIEW_FIELDS,
    dependencies.fetch ?? fetch,
    dependencies.apiTimeoutMs,
  );
  const reviews = raw && typeof raw === "object" && "reviews" in raw &&
    Array.isArray(raw.reviews)
    ? raw.reviews.map(sanitizeReview).filter((review): review is GoogleReviewPreview => Boolean(review))
    : [];
  if (reviews.length === 0) throw new GooglePlacesError("NO_REVIEWS");
  return reviews;
}
