import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  extractPlaceIdFromMapsUrl,
  extractPlaceQueryFromMapsUrl,
  findUniqueReviewBySourceUrl,
  normalizeGoogleMapsUrl,
  type GoogleReviewPreview,
} from "./googlePlaces";
import {
  GooglePlacesError,
  loadGoogleReviews,
  resolveGoogleMapsUrl,
  searchGooglePlace,
} from "./googlePlaces.server";
import {
  getDefaultQuestionTemplateData,
  getQuestionTemplateValidationIssue,
  parseGooglePlaceAverageRatingInput,
  parseGooglePlaceReviewCountInput,
  parseQuestionTemplateData,
} from "./templates/questionTemplateData";
import {
  buildQuestionTemplateRuntimeModel,
  formatGooglePlaceRatingSummary,
} from "./templates/questionTemplateRuntime";
import { questionTemplateIds } from "./templates/questionTemplateRegistry";
import { resolveGooglePlacesFeature } from "./googlePlacesFeature";

const publicLookup = (async () =>
  [{ address: "142.250.74.206", family: 4 }]) as never;

test("Google Maps URLs are narrowly allow-listed and parsed", () => {
  assert.ok(normalizeGoogleMapsUrl("https://maps.app.goo.gl/abc"));
  assert.ok(normalizeGoogleMapsUrl(
    "https://www.google.com/maps/place/Markthalle+Stuttgart",
  ));
  assert.equal(normalizeGoogleMapsUrl(
    "http://www.google.com/maps/place/test",
  ), null);
  assert.equal(normalizeGoogleMapsUrl("https://example.org/maps"), null);
  assert.equal(normalizeGoogleMapsUrl("https://127.0.0.1/maps"), null);
  assert.equal(
    extractPlaceIdFromMapsUrl(
      "https://www.google.com/maps/search/?query=x&query_place_id=ChIJ1234567890",
    ),
    "ChIJ1234567890",
  );
  assert.equal(
    extractPlaceQueryFromMapsUrl(
      "https://www.google.com/maps/place/Markthalle+Stuttgart",
    ),
    "Markthalle Stuttgart",
  );
});

test("short links are resolved with host revalidation", async () => {
  const redirects = (async () => new Response(null, {
    status: 302,
    headers: {
      location: "https://www.google.com/maps/place/Markthalle+Stuttgart",
    },
  })) as typeof fetch;
  assert.equal(
    await resolveGoogleMapsUrl("https://maps.app.goo.gl/abc", {
      fetch: redirects,
      lookup: publicLookup,
    }),
    "https://www.google.com/maps/place/Markthalle+Stuttgart",
  );

  const unsafeRedirect = (async () => new Response(null, {
    status: 302,
    headers: { location: "https://example.org/secret" },
  })) as typeof fetch;
  await assert.rejects(
    resolveGoogleMapsUrl("https://maps.app.goo.gl/abc", {
      fetch: unsafeRedirect,
      lookup: publicLookup,
    }),
    (error: unknown) =>
      error instanceof GooglePlacesError &&
      error.code === "DISALLOWED_MAPS_HOST",
  );
});

test("private DNS results and excessive redirects are rejected", async () => {
  const privateLookup = (async () =>
    [{ address: "127.0.0.1", family: 4 }]) as never;
  await assert.rejects(
    resolveGoogleMapsUrl("https://maps.app.goo.gl/abc", {
      fetch: (async () => new Response()) as typeof fetch,
      lookup: privateLookup,
    }),
    (error: unknown) =>
      error instanceof GooglePlacesError &&
      error.code === "DISALLOWED_MAPS_HOST",
  );
  const endlessRedirect = (async () => new Response(null, {
    status: 302,
    headers: { location: "https://maps.app.goo.gl/abc" },
  })) as typeof fetch;
  await assert.rejects(
    resolveGoogleMapsUrl("https://maps.app.goo.gl/abc", {
      fetch: endlessRedirect,
      lookup: publicLookup,
    }),
    (error: unknown) =>
      error instanceof GooglePlacesError &&
      error.code === "SHORT_LINK_FAILED",
  );
});

test("short-link timeout is reported without downloading a response", async () => {
  const hangingFetch = (async (
    _input: URL | RequestInfo,
    init?: RequestInit,
  ) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("Aborted", "AbortError")));
  })) as typeof fetch;
  await assert.rejects(
    resolveGoogleMapsUrl("https://maps.app.goo.gl/abc", {
      fetch: hangingFetch,
      lookup: publicLookup,
      timeoutMs: 5,
    }),
    (error: unknown) =>
      error instanceof GooglePlacesError &&
      error.code === "REQUEST_TIMEOUT",
  );
});

test("Places responses are reduced to transient preview fields", async () => {
  const apiFetch = (async () => Response.json({
    places: [{
      id: "ChIJ1234567890",
      displayName: { text: "Markthalle Stuttgart" },
      formattedAddress: "Dorotheenstraße 4, Stuttgart",
      rating: 4.4,
      userRatingCount: 12345,
      googleMapsUri: "https://maps.google.com/?cid=123",
      forbiddenRawField: "must not escape",
    }],
  })) as typeof fetch;
  const result = await searchGooglePlace(
    "https://www.google.com/maps/place/Markthalle+Stuttgart",
    "test-key",
    { fetch: apiFetch, lookup: publicLookup },
  );
  assert.deepEqual(Object.keys(result.places[0]).sort(), [
    "attributionText",
    "displayName",
    "formattedAddress",
    "googleMapsUri",
    "placeId",
    "rating",
    "userRatingCount",
  ]);
  assert.equal(JSON.stringify(result).includes("forbiddenRawField"), false);
});

test("missing configuration and quota errors remain qualified", async () => {
  await assert.rejects(
    searchGooglePlace(
      "https://www.google.com/maps/place/Test",
      "",
      { lookup: publicLookup },
    ),
    (error: unknown) =>
      error instanceof GooglePlacesError &&
      error.code === "NOT_CONFIGURED",
  );
  const quotaFetch = (async () => new Response(null, {
    status: 429,
  })) as typeof fetch;
  await assert.rejects(
    searchGooglePlace(
      "https://www.google.com/maps/place/Test",
      "test-key",
      { fetch: quotaFetch, lookup: publicLookup },
    ),
    (error: unknown) =>
      error instanceof GooglePlacesError &&
      error.code === "QUOTA_UNAVAILABLE",
  );
});

test("review previews carry official attribution and direct links only", async () => {
  const apiFetch = (async () => Response.json({
    reviews: [{
      name: "places/x/reviews/one",
      originalText: { text: "Großartig" },
      rating: 5,
      relativePublishTimeDescription: "vor einem Monat",
      googleMapsUri: "https://www.google.com/maps/reviews/one",
      authorAttribution: {
        displayName: "Ada",
        uri: "https://www.google.com/maps/contrib/ada",
      },
      internalPayload: { forbidden: true },
    }],
  })) as typeof fetch;
  const reviews = await loadGoogleReviews("ChIJ1234567890", "test-key", {
    fetch: apiFetch,
  });
  assert.equal(reviews[0].text, "Großartig");
  assert.equal(reviews[0].attributionText, "Ada · Google Maps");
  assert.equal(JSON.stringify(reviews).includes("internalPayload"), false);
});

test("a shared review link matches only one exact official source URL", () => {
  const review = (id: string): GoogleReviewPreview => ({
    id,
    text: id,
    authorName: "",
    authorUri: "",
    rating: null,
    publishedLabel: "",
    sourceUrl: "https://www.google.com/maps/reviews/one",
    attributionText: "Google Maps",
  });
  assert.equal(findUniqueReviewBySourceUrl(
    [review("one")],
    "https://www.google.com/maps/reviews/one",
  )?.id, "one");
  assert.equal(findUniqueReviewBySourceUrl(
    [review("one"), review("two")],
    "https://www.google.com/maps/reviews/one",
  ), null);
});

test("persisted Google data excludes live metrics and raw payloads", () => {
  const parsed = parseQuestionTemplateData({
    kind: "GOOGLE_REVIEWS",
    placeId: "ChIJ1234567890",
    placeName: "Markthalle",
    placeAdditionalLabel: "Stuttgart",
    placeMapsUrl: "https://maps.google.com/?cid=123",
    placeImportedOrEditedAt: "2026-07-24T10:00:00.000Z",
    cachedGoogleRating: 4.4,
    cachedGoogleAddress: "secret",
    rawPlaceDetailsResponse: { secret: true },
    reviews: [{
      id: "review-1",
      text: "Großartig",
      authorName: "Ada",
      rating: 5,
      publishedLabel: "vor einem Monat",
      sourceUrl: "https://www.google.com/maps/reviews/one",
      attributionText: "Ada · Google Maps",
      importedOrEditedAt: "2026-07-24T10:00:00.000Z",
      rawReviewResponse: { secret: true },
    }],
    explanation: "",
    sequentialReveal: true,
    hideAuthorUntilSolution: false,
    hideRatingUntilSolution: false,
  }, questionTemplateIds.googleReviews, false);
  assert.ok(parsed && parsed.kind === "GOOGLE_REVIEWS");
  assert.equal(parsed.placeId, "ChIJ1234567890");
  assert.equal(parsed.reviews[0].attributionText, "Ada · Google Maps");
  const serialized = JSON.stringify(parsed);
  for (const forbidden of [
    "cachedGoogleRating",
    "cachedGoogleAddress",
    "rawPlaceDetailsResponse",
    "rawReviewResponse",
  ]) assert.equal(serialized.includes(forbidden), false);
});

test("manual Google review data is complete without API-only references", () => {
  const parsed = parseQuestionTemplateData({
    kind: "GOOGLE_REVIEWS",
    placeName: "Manueller Ort",
    reviews: [{
      id: "review-1",
      text: "Manuell gepflegte Rezension",
      authorName: "",
      rating: 4,
      publishedLabel: "",
      sourceUrl: "",
      attributionText: "",
      importedOrEditedAt: "",
    }],
    explanation: "Wird in der Auflösung gezeigt.",
    sequentialReveal: false,
    hideAuthorUntilSolution: false,
    hideRatingUntilSolution: false,
  }, questionTemplateIds.googleReviews, true);
  assert.ok(parsed && parsed.kind === "GOOGLE_REVIEWS");
  assert.equal(parsed.placeMapsUrl, "");
  assert.equal(parsed.explanation, "Wird in der Auflösung gezeigt.");
});

test("Google location metrics accept localized input and reject invalid values", () => {
  assert.equal(parseGooglePlaceAverageRatingInput(""), null);
  assert.equal(parseGooglePlaceAverageRatingInput("0"), 0);
  assert.equal(parseGooglePlaceAverageRatingInput("4,4"), 4.4);
  assert.equal(parseGooglePlaceAverageRatingInput("4.4"), 4.4);
  assert.equal(parseGooglePlaceAverageRatingInput("5"), 5);
  assert.equal(parseGooglePlaceAverageRatingInput("-0,1"), undefined);
  assert.equal(parseGooglePlaceAverageRatingInput("5,1"), undefined);
  assert.equal(parseGooglePlaceAverageRatingInput("4,44"), undefined);

  assert.equal(parseGooglePlaceReviewCountInput(""), null);
  assert.equal(parseGooglePlaceReviewCountInput("0"), 0);
  assert.equal(parseGooglePlaceReviewCountInput("18763"), 18_763);
  assert.equal(parseGooglePlaceReviewCountInput("18.763"), 18_763);
  assert.equal(parseGooglePlaceReviewCountInput("18 763"), 18_763);
  assert.equal(parseGooglePlaceReviewCountInput("-1"), undefined);
  assert.equal(parseGooglePlaceReviewCountInput("1,5"), undefined);
});

test("Google location metrics normalize, persist and remain legacy-compatible", () => {
  const defaults = getDefaultQuestionTemplateData(
    questionTemplateIds.googleReviews,
  );
  assert.ok(defaults && defaults.kind === "GOOGLE_REVIEWS");
  const configured = {
    ...defaults,
    placeName: "Wilhelma Stuttgart",
    placeAverageRating: 4.4,
    placeReviewCount: 18_763,
    reviews: [{ ...defaults.reviews[0], text: "Ein schöner Ort" }],
  };
  const parsed = parseQuestionTemplateData(
    JSON.parse(JSON.stringify(configured)),
    questionTemplateIds.googleReviews,
    true,
  );
  assert.ok(parsed && parsed.kind === "GOOGLE_REVIEWS");
  assert.equal(parsed.placeAverageRating, 4.4);
  assert.equal(parsed.placeReviewCount, 18_763);
  assert.deepEqual(structuredClone(parsed), parsed);

  const legacy: Record<string, unknown> = structuredClone(configured);
  delete legacy.placeAverageRating;
  delete legacy.placeReviewCount;
  const parsedLegacy = parseQuestionTemplateData(
    legacy,
    questionTemplateIds.googleReviews,
    true,
  );
  assert.ok(parsedLegacy && parsedLegacy.kind === "GOOGLE_REVIEWS");
  assert.equal(parsedLegacy.placeAverageRating, null);
  assert.equal(parsedLegacy.placeReviewCount, null);
});

test("Google location metric validation returns qualified field errors", () => {
  const defaults = getDefaultQuestionTemplateData(
    questionTemplateIds.googleReviews,
  );
  assert.ok(defaults && defaults.kind === "GOOGLE_REVIEWS");
  assert.deepEqual(getQuestionTemplateValidationIssue({
    ...defaults,
    placeAverageRating: 5.1,
  }, questionTemplateIds.googleReviews), {
    code: "GOOGLE_PLACE_AVERAGE_RATING_INVALID",
    field: "templatePlaceAverageRating",
    message: "Die durchschnittliche Bewertung muss zwischen 0 und 5 liegen.",
  });
  assert.deepEqual(getQuestionTemplateValidationIssue({
    ...defaults,
    placeReviewCount: 1.5,
  }, questionTemplateIds.googleReviews), {
    code: "GOOGLE_PLACE_REVIEW_COUNT_INVALID",
    field: "templatePlaceReviewCount",
    message: "Die Anzahl der Rezensionen muss eine nicht negative ganze Zahl sein.",
  });
  assert.equal(parseQuestionTemplateData({
    ...defaults,
    placeReviewCount: -1,
  }, questionTemplateIds.googleReviews, false), null);
});

test("Google location metrics are formatted only for the solution runtime", () => {
  assert.equal(formatGooglePlaceRatingSummary({
    placeAverageRating: 4.4,
    placeReviewCount: 18_763,
  }), "4,4 von 5 Sternen · 18.763 Rezensionen");
  assert.equal(formatGooglePlaceRatingSummary({
    placeAverageRating: 5,
    placeReviewCount: null,
  }), "5 von 5 Sternen");
  assert.equal(formatGooglePlaceRatingSummary({
    placeAverageRating: null,
    placeReviewCount: 1,
  }), "1 Rezension");
  assert.equal(formatGooglePlaceRatingSummary({
    placeAverageRating: null,
    placeReviewCount: null,
  }), "");

  const defaults = getDefaultQuestionTemplateData(
    questionTemplateIds.googleReviews,
  );
  assert.ok(defaults && defaults.kind === "GOOGLE_REVIEWS");
  const runtime = buildQuestionTemplateRuntimeModel({
    templateId: questionTemplateIds.googleReviews,
    questionText: "Welcher Ort ist gesucht?",
    templateConfig: {
      stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 },
      createPixelQuestionByAnswer: { answer1: false, answer2: false },
      templateData: {
        ...defaults,
        placeName: "Wilhelma Stuttgart",
        placeAverageRating: 4.4,
        placeReviewCount: 18_763,
      },
    },
    correctAnswers: [],
  });
  assert.deepEqual(runtime.solutionLines.slice(0, 2), [
    "Wilhelma Stuttgart",
    "4,4 von 5 Sternen · 18.763 Rezensionen",
  ]);

  const player = readFileSync(
    "app/rendering/presentation/PresentationSlideRenderer.tsx",
    "utf8",
  );
  assert.doesNotMatch(player, /placeAverageRating|placeReviewCount/);
});

test("research is authorized server-side and absent from presentation", () => {
  const actions = readFileSync(
    "app/fragen/editor/googlePlacesActions.ts",
    "utf8",
  );
  const player = readFileSync(
    "app/rendering/presentation/PresentationSlideRenderer.tsx",
    "utf8",
  );
  assert.match(actions, /await requireQuestionEditor\(\)/);
  assert.match(actions, /process\.env\.GOOGLE_MAPS_API_KEY/);
  assert.doesNotMatch(player, /googlePlacesActions|places\.googleapis\.com/);
});

test("Google research UI requires both explicit enablement and configuration", () => {
  assert.deepEqual(resolveGooglePlacesFeature({
    apiKey: undefined,
    explicitlyEnabled: undefined,
  }), { available: false });
  assert.deepEqual(resolveGooglePlacesFeature({
    apiKey: "AIza-valid-looking-key-for-tests",
    explicitlyEnabled: "false",
  }), { available: false });
  assert.deepEqual(resolveGooglePlacesFeature({
    apiKey: "AIza-valid-looking-key-for-tests",
    explicitlyEnabled: "true",
  }), { available: true });

  const editor = readFileSync(
    "app/fragen/editor/components/StructuredTemplateEditor.tsx",
    "utf8",
  );
  assert.match(editor, /props\.googlePlacesFeature\.available &&/);
  assert.doesNotMatch(editor, />Google Place ID/);
  assert.doesNotMatch(editor, />Attribution/);
  assert.doesNotMatch(editor, /nicht konfiguriert/);
  assert.match(editor, /Google-Maps-Link zum Ort/);
  assert.match(editor, /Link zur Google-Rezension \(optional\)/);
  assert.match(editor, /Auflösung \/ Hintergrund/);
  assert.match(editor, /Interne Hinweise gehören in die Moderationsnotizen/);
});

test("Google review editor keeps compact manual controls", () => {
  const editor = readFileSync(
    "app/fragen/editor/components/StructuredTemplateEditor.tsx",
    "utf8",
  );
  const checkbox = readFileSync("components/ui/Checkbox.tsx", "utf8");
  assert.match(editor, /sm:grid-cols-\[minmax\(0,1fr\)_8rem_minmax\(0,1fr\)\]/);
  assert.match(editor, /Durchschnittliche Bewertung/);
  assert.match(editor, /Anzahl der Rezensionen/);
  assert.match(editor, /sm:grid-cols-2/);
  assert.ok(
    editor.indexOf("Gesuchter Ort") <
      editor.indexOf("Durchschnittliche Bewertung"),
  );
  assert.ok(
    editor.indexOf("Anzahl der Rezensionen") <
      editor.indexOf("Google-Maps-Link zum Ort"),
  );
  assert.match(editor, /<legend className="text-sm font-semibold">Darstellung/);
  assert.match(editor, /sm:grid-cols-3/);
  assert.match(editor, /<Checkbox/);
  assert.match(editor, /variant="card"/);
  assert.doesNotMatch(editor, /\{checked \? "✓" : "○"\}/);
  assert.match(checkbox, /type="checkbox"/);
  assert.match(checkbox, /variant\?: "default" \| "card"/);
  assert.match(checkbox, /focus-within:ring-2/);
  assert.match(checkbox, /has-\[:checked\]:border-blue-600/);
  assert.doesNotMatch(checkbox, /✓|○/);
});

test("central card checkbox renders one native keyboard-operable control", () => {
  const active = renderToStaticMarkup(createElement(Checkbox, {
    variant: "card",
    label: "Nacheinander",
    checked: true,
    readOnly: true,
  }));
  const inactive = renderToStaticMarkup(createElement(Checkbox, {
    variant: "card",
    label: "Autor später",
    checked: false,
    readOnly: true,
  }));
  assert.equal(active.match(/type="checkbox"/g)?.length, 1);
  assert.match(active, /checked=""/);
  assert.doesNotMatch(inactive, /checked=""/);
  assert.doesNotMatch(`${active}${inactive}`, /✓|○/);
  assert.match(active, /focus-within:ring-2/);
});

test("Google display options preserve defaults and every stored combination", () => {
  const defaults = getDefaultQuestionTemplateData(
    questionTemplateIds.googleReviews,
  );
  assert.ok(defaults && defaults.kind === "GOOGLE_REVIEWS");
  assert.deepEqual({
    sequentialReveal: defaults.sequentialReveal,
    hideAuthorUntilSolution: defaults.hideAuthorUntilSolution,
    hideRatingUntilSolution: defaults.hideRatingUntilSolution,
  }, {
    sequentialReveal: true,
    hideAuthorUntilSolution: false,
    hideRatingUntilSolution: false,
  });

  for (const values of [
    [false, false, false],
    [true, false, false],
    [false, true, false],
    [false, false, true],
    [true, true, true],
  ] as const) {
    const parsed = parseQuestionTemplateData({
      ...defaults,
      sequentialReveal: values[0],
      hideAuthorUntilSolution: values[1],
      hideRatingUntilSolution: values[2],
    }, questionTemplateIds.googleReviews, false);
    assert.ok(parsed && parsed.kind === "GOOGLE_REVIEWS");
    assert.deepEqual([
      parsed.sequentialReveal,
      parsed.hideAuthorUntilSolution,
      parsed.hideRatingUntilSolution,
    ], values);
  }
});
