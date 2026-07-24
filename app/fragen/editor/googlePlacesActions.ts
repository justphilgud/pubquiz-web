"use server";

import { requireQuestionEditor } from "@/app/lib/permissions";
import { getCurrentUserId } from "@/app/services/questionService";
import {
  type GooglePlaceSearchResult,
  type GoogleReviewSearchResult,
} from "./googlePlaces";
import {
  GooglePlacesError,
  loadGoogleReviews,
  searchGooglePlace,
} from "./googlePlaces.server";
import { resolveGooglePlacesFeature } from "./googlePlacesFeature";

const requestsByUser = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (requestsByUser.get(userId) ?? [])
    .filter((timestamp) => timestamp > now - RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requestsByUser.set(userId, recent);
    return true;
  }
  requestsByUser.set(userId, [...recent, now]);
  return false;
}

function errorCode(error: unknown) {
  return error instanceof GooglePlacesError ? error.code : "REQUEST_FAILED";
}

export async function searchGooglePlaceAction(
  mapsUrl: string,
): Promise<GooglePlaceSearchResult> {
  const session = await requireQuestionEditor();
  const feature = resolveGooglePlacesFeature({
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    explicitlyEnabled: process.env.GOOGLE_PLACES_FEATURE_ENABLED,
  });
  if (!feature.available) return { ok: false, code: "NOT_CONFIGURED" };
  if (isRateLimited(String(getCurrentUserId(session)))) {
    return { ok: false, code: "RATE_LIMITED" };
  }
  try {
    const result = await searchGooglePlace(
      mapsUrl,
      process.env.GOOGLE_MAPS_API_KEY ?? "",
    );
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, code: errorCode(error) };
  }
}

export async function loadGoogleReviewsAction(
  placeId: string,
): Promise<GoogleReviewSearchResult> {
  const session = await requireQuestionEditor();
  const feature = resolveGooglePlacesFeature({
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    explicitlyEnabled: process.env.GOOGLE_PLACES_FEATURE_ENABLED,
  });
  if (!feature.available) return { ok: false, code: "NOT_CONFIGURED" };
  if (isRateLimited(String(getCurrentUserId(session)))) {
    return { ok: false, code: "RATE_LIMITED" };
  }
  try {
    const reviews = await loadGoogleReviews(
      placeId,
      process.env.GOOGLE_MAPS_API_KEY ?? "",
    );
    return { ok: true, reviews };
  } catch (error) {
    return { ok: false, code: errorCode(error) };
  }
}
