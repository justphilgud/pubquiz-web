"use client";

import { useState, type ComponentType } from "react";
import { CharacterCount } from "./CharacterCount";
import { SortableTemplateList } from "./SortableTemplateList";
import { resolveSpeechVoice, useSpeechVoices } from "./useSpeechVoices";
import {
  generateAnagramSuggestions,
  getAnswersForTemplateData,
  isAllowedGoogleMapsUrl,
  isExactAnagram,
  QUESTION_LANGUAGE_CODES,
  TRANSLATION_TEXT_MAX_LENGTH,
} from "../templates/questionTemplateData";
import {
  loadGoogleReviewsAction,
  searchGooglePlaceAction,
} from "../googlePlacesActions";
import {
  findUniqueReviewBySourceUrl,
  type GooglePlacePreview,
  type GooglePlacesErrorCode,
  type GoogleReviewPreview,
} from "../googlePlaces";
import type { GooglePlacesFeature } from "../googlePlacesFeature";
import { Checkbox } from "@/components/ui/Checkbox";
import type {
  QuestionAnswerDraft,
  QuestionTemplateData,
  QuestionTemplateSurfaceKind,
} from "../types";

type Props = {
  kind: QuestionTemplateSurfaceKind;
  data: QuestionTemplateData | undefined;
  disabled: boolean;
  onChange: (data: QuestionTemplateData, answers: QuestionAnswerDraft[]) => void;
  answers: readonly QuestionAnswerDraft[];
  validationError?: string | null;
  googlePlacesFeature: GooglePlacesFeature;
};

type EditorProps = Omit<Props, "kind">;
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2";

function previewSpeech(text: string, speed: number, voiceId = "default") {
  if (!text.trim() || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  utterance.voice = resolveSpeechVoice(voiceId);
  window.speechSynthesis.speak(utterance);
}

function commit(props: EditorProps, data: QuestionTemplateData) {
  props.onChange(data, getAnswersForTemplateData(data, props.answers));
}

function TrueFalseEditor(props: EditorProps) {
  if (props.data?.kind !== "TRUE_FALSE") return null;
  const data = props.data;
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="font-semibold">Wahr oder falsch</h2>
    <fieldset>
      <legend className="text-sm font-medium">Richtige Antwort</legend>
      <div className="mt-2 grid max-w-md grid-cols-2 rounded-xl border border-slate-300 bg-slate-100 p-1" role="group">
        {[true, false].map((value) => {
          const active = data.correctAnswer === value;
          return <button key={String(value)} type="button" aria-pressed={active} disabled={props.disabled}
            onClick={() => commit(props, { ...data, correctAnswer: value })}
            className={`min-h-11 rounded-lg px-4 py-2 font-semibold ${active ? "bg-slate-950 text-white shadow-sm" : "text-slate-700"}`}>
            <span aria-hidden="true" className="mr-2 inline-block w-4">{active ? "✓" : ""}</span>
            {value ? "Wahr" : "Falsch"}
          </button>;
        })}
      </div>
    </fieldset>
    <label className="block text-sm font-medium">Erklärung
      <textarea className={`${inputClass} mt-1`} value={data.explanation} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, explanation: event.target.value })} />
    </label>
  </section>;
}

function EstimateEditor(props: EditorProps) {
  if (props.data?.kind !== "ESTIMATE") return null;
  const data = props.data;
  return <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
    <h2 className="font-semibold sm:col-span-2">Schätzfrage</h2>
    <label className="text-sm font-medium">Korrekter Zahlenwert
      <input type="number" className={`${inputClass} mt-1`} value={data.correctValue ?? ""} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, correctValue: event.target.value === "" ? null : Number(event.target.value) })} />
    </label>
    <label className="text-sm font-medium">Einheit
      <input required data-template-unit aria-invalid={Boolean(props.validationError)}
        className={`${inputClass} mt-1 ${props.validationError ? "border-red-500" : ""}`} value={data.unit} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, unit: event.target.value })} />
      {props.validationError && <span role="alert" className="mt-1 block text-sm text-red-700">{props.validationError}</span>}
    </label>
    <label className="text-sm font-medium">Zahlenformat
      <select className={`${inputClass} mt-1`} value={data.numberFormat} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, numberFormat: event.target.value as typeof data.numberFormat })}>
        <option value="INTEGER">Ganzzahl</option>
        <option value="DECIMAL">Dezimalzahl</option>
        <option value="YEAR">Jahr</option>
        <option value="PERCENT">Prozent</option>
      </select>
    </label>
    <p className="self-end rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Schätzfragen können auch zur Auflösung eines Punktegleichstands verwendet werden.</p>
    <label className="text-sm font-medium sm:col-span-2">Erklärung
      <textarea className={`${inputClass} mt-1`} value={data.explanation} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, explanation: event.target.value })} />
    </label>
  </section>;
}

function OrderingEditor(props: EditorProps) {
  if (props.data?.kind !== "ORDERING") return null;
  const data = props.data;
  const updateItems = (items: typeof data.items) => commit(props, { ...data, items });
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="font-semibold">Richtige Reihenfolge</h2>
    <SortableTemplateList
      ids={data.items.map((item) => item.id)}
      disabled={props.disabled}
      onReorder={(ids) => updateItems(ids.map((id) => data.items.find((item) => item.id === id)!))}
    >
      {(id, index, dragHandle) => {
        const item = data.items.find((entry) => entry.id === id)!;
        return <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[auto_2rem_1fr_1fr_auto]">
          {dragHandle}
          <span className="pt-3 text-center font-semibold" aria-label={`Position ${index + 1}`}>{index + 1}</span>
          <input aria-label={`Begriff ${index + 1}`} className={inputClass} value={item.text} disabled={props.disabled}
            onChange={(event) => updateItems(data.items.map((entry) => entry.id === item.id ? { ...entry, text: event.target.value } : entry))} />
          <input aria-label={`Erklärung ${index + 1}`} placeholder="Erklärung (optional)" className={inputClass} value={item.explanation} disabled={props.disabled}
            onChange={(event) => updateItems(data.items.map((entry) => entry.id === item.id ? { ...entry, explanation: event.target.value } : entry))} />
          <div className="flex gap-1">
            <button type="button" aria-label={`${item.text || "Begriff"} nach oben`} className="min-h-11 px-2" disabled={props.disabled || index === 0}
              onClick={() => { const next = [...data.items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateItems(next); }}>↑</button>
            <button type="button" aria-label={`${item.text || "Begriff"} nach unten`} className="min-h-11 px-2" disabled={props.disabled || index === data.items.length - 1}
              onClick={() => { const next = [...data.items]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; updateItems(next); }}>↓</button>
            <button type="button" aria-label={`${item.text || "Begriff"} löschen`} className="min-h-11 px-2 text-red-700" disabled={props.disabled || data.items.length <= 2}
              onClick={() => updateItems(data.items.filter((entry) => entry.id !== item.id))}>×</button>
          </div>
        </div>;
      }}
    </SortableTemplateList>
    <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-3" disabled={props.disabled}
      onClick={() => updateItems([...data.items, { id: crypto.randomUUID(), text: "", explanation: "" }])}>+ Begriff</button>
    <p className="text-xs text-slate-600">Bewertung: Punkte gibt es derzeit nur für eine vollständig richtige Reihenfolge. Eine Teilbewertung pro korrekter Position ist für eine spätere Erweiterung vorgesehen.</p>
  </section>;
}

const languageNames: Record<(typeof QUESTION_LANGUAGE_CODES)[number], string> = {
  de: "Deutsch", en: "Englisch", fr: "Französisch",
  es: "Spanisch", it: "Italienisch", nl: "Niederländisch",
};

function TranslationEditor(props: EditorProps) {
  const targetLanguage = props.data?.kind === "TRANSLATION_READ_ALOUD" ? props.data.targetLanguage : "";
  const voiceGroups = useSpeechVoices(targetLanguage);
  if (props.data?.kind !== "TRANSLATION_READ_ALOUD") return null;
  const data = props.data;
  const voices = [...voiceGroups.matching, ...voiceGroups.others];
  const selectedVoice = voices.some((voice) => voice.id === data.voiceId)
    ? data.voiceId
    : "default";
  const updateSolution = (value: string) => {
    const answers = getAnswersForTemplateData(data, props.answers);
    props.onChange(data, answers.map((answer, index) => index === 0 ? { ...answer, text: value } : answer));
  };
  return <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
    <h2 className="font-semibold sm:col-span-2">Übersetzt vorgelesen</h2>
    <label className="text-sm font-medium sm:col-span-2">Original
      <textarea className={`${inputClass} mt-1`} maxLength={TRANSLATION_TEXT_MAX_LENGTH} value={data.originalText} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, originalText: event.target.value })} />
      <CharacterCount current={data.originalText.length} maximum={TRANSLATION_TEXT_MAX_LENGTH} warningAt={1_800} />
    </label>
    <label className="text-sm font-medium sm:col-span-2">Übersetzung
      <textarea className={`${inputClass} mt-1`} maxLength={TRANSLATION_TEXT_MAX_LENGTH} value={data.translation} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, translation: event.target.value })} />
      <CharacterCount current={data.translation.length} maximum={TRANSLATION_TEXT_MAX_LENGTH} warningAt={1_800} />
    </label>
    <label className="text-sm font-medium">Ausgangssprache
      <select className={`${inputClass} mt-1`} value={data.sourceLanguage} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, sourceLanguage: event.target.value })}>
        {QUESTION_LANGUAGE_CODES.map((code) => <option key={code} value={code} disabled={code === data.targetLanguage}>{languageNames[code]}</option>)}
      </select>
    </label>
    <label className="text-sm font-medium">Zielsprache
      <select className={`${inputClass} mt-1`} value={data.targetLanguage} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, targetLanguage: event.target.value, voiceId: "default" })}>
        {QUESTION_LANGUAGE_CODES.map((code) => <option key={code} value={code} disabled={code === data.sourceLanguage}>{languageNames[code]}</option>)}
      </select>
    </label>
    <label className="text-sm font-medium">Stimme
      <select className={`${inputClass} mt-1`} value={selectedVoice} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, voiceId: event.target.value })}>
        <option value="default">Standardstimme</option>
        {voiceGroups.matching.length > 0 && <optgroup label="Passend zur Zielsprache">
          {voiceGroups.matching.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
        </optgroup>}
        {voiceGroups.others.length > 0 && <optgroup label="Weitere Stimmen">
          {voiceGroups.others.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
        </optgroup>}
      </select>
      {data.voiceId !== "default" && selectedVoice === "default" && <span className="mt-1 block text-xs text-amber-700">Die gespeicherte Stimme ist auf diesem Gerät nicht verfügbar. Es wird die Standardstimme verwendet.</span>}
    </label>
    <label className="text-sm font-medium">Geschwindigkeit ({data.speed.toFixed(1)}×)
      <input type="range" min="0.5" max="2" step="0.1" className="mt-3 w-full" value={data.speed} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, speed: Number(event.target.value) })} />
      <span className="flex justify-between text-xs text-slate-500"><span>langsam</span><span>normal</span><span>schnell</span></span>
    </label>
    <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-3" disabled={props.disabled || !data.translation.trim()}
      onClick={() => previewSpeech(data.translation, data.speed, selectedVoice)}>Audio-Vorschau abspielen</button>
    <label className="text-sm font-medium sm:col-span-2">Gesuchte Lösung
      <input maxLength={200} className={`${inputClass} mt-1`} value={props.answers[0]?.text ?? ""} disabled={props.disabled}
        onChange={(event) => updateSolution(event.target.value)} />
      <CharacterCount current={props.answers[0]?.text.length ?? 0} maximum={200} warningAt={170} />
    </label>
    <p className="text-xs text-slate-600 sm:col-span-2">Übersetzung und Sprachausgabe laufen über getrennte Generatoren. Ohne konfigurierten Provider bleiben die Inhalte manuell editierbar.</p>
  </section>;
}

function AnagramEditor(props: EditorProps) {
  if (props.data?.kind !== "ANAGRAM") return null;
  const data = props.data;
  const valid = !data.selectedSolution || isExactAnagram(data.name, data.selectedSolution);
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="font-semibold">Anagramm</h2>
    <label className="block text-sm font-medium">Gesuchter Name
      <input className={`${inputClass} mt-1`} value={data.name} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, name: event.target.value, suggestions: [] })} />
    </label>
    <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-3" disabled={props.disabled || data.name.trim().length < 2}
      onClick={() => commit(props, { ...data, suggestions: generateAnagramSuggestions(data.name) })}>Anagramme erzeugen</button>
    <p className="text-xs text-slate-600">Die Vorschläge werden lokal aus Wörtern und aussprechbaren Fantasiebegriffen erzeugt. Das Anagramm kann anschließend manuell angepasst werden.</p>
    {data.suggestions.length > 0 && <div className="flex flex-wrap gap-2">{data.suggestions.map((suggestion) =>
      <button type="button" key={suggestion} className="rounded-full border px-3 py-2 uppercase" disabled={props.disabled}
        onClick={() => commit(props, { ...data, selectedSolution: suggestion })}>{suggestion}</button>)}</div>}
    {data.suggestions.length === 0 && data.name.trim().length >= 2 && (
      <p className="text-sm text-amber-700">Es konnten keine passenden Vorschläge erzeugt werden. Du kannst das Anagramm manuell eingeben.</p>
    )}
    <label className="block text-sm font-medium">Anagramm (manuell editierbar)
      <input className={`${inputClass} mt-1 uppercase ${valid ? "" : "border-red-500"}`} value={data.selectedSolution} disabled={props.disabled}
        onChange={(event) => commit(props, { ...data, selectedSolution: event.target.value.toLocaleUpperCase("de-DE") })} />
    </label>
    {!valid && <p role="alert" className="text-sm text-red-700">Das Anagramm muss exakt dieselben Buchstaben und Ziffern enthalten.</p>}
  </section>;
}

function ReviewsEditor(props: EditorProps) {
  const [placePreviews, setPlacePreviews] = useState<GooglePlacePreview[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlacePreview | null>(null);
  const [reviewPreviews, setReviewPreviews] = useState<GoogleReviewPreview[]>([]);
  const [loading, setLoading] = useState<"place" | "reviews" | null>(null);
  const [researchMessage, setResearchMessage] = useState("");
  if (props.data?.kind !== "GOOGLE_REVIEWS") return null;
  const data = props.data;
  const updateReviews = (reviews: typeof data.reviews) => commit(props, { ...data, reviews });
  const errorMessage = (code: GooglePlacesErrorCode) => ({
    INVALID_MAPS_URL: "Bitte gib einen gültigen HTTPS-Link zu Google Maps ein.",
    DISALLOWED_MAPS_HOST: "Dieser Link führt nicht zu einer erlaubten Google-Maps-Domain.",
    SHORT_LINK_FAILED: "Der Google-Kurzlink konnte nicht sicher aufgelöst werden.",
    PLACE_NOT_FOUND: "Über diesen Link konnte kein Ort ermittelt werden.",
    MULTIPLE_PLACES: "Es wurden mehrere mögliche Orte gefunden. Bitte wähle einen aus.",
    INVALID_PLACE_ID: "Der gewählte Google-Ort ist ungültig oder nicht mehr verfügbar.",
    NOT_CONFIGURED: "Die Google-Recherche ist derzeit nicht verfügbar.",
    REQUEST_FAILED: "Die Google-Anfrage ist fehlgeschlagen. Die manuelle Pflege bleibt möglich.",
    QUOTA_UNAVAILABLE: "Google Places ist wegen Kontingent oder Abrechnung derzeit nicht verfügbar.",
    REQUEST_TIMEOUT: "Die Google-Anfrage hat zu lange gedauert.",
    NO_REVIEWS: "Google hat für diesen Ort keine Rezensionen geliefert.",
    REVIEW_NOT_UNIQUE: "Die verlinkte Rezension konnte nicht eindeutig über die offizielle Google-Schnittstelle gefunden werden. Bitte wähle eine verfügbare Rezension aus oder übernimm den Text manuell.",
    RATE_LIMITED: "Zu viele Google-Anfragen in kurzer Zeit. Bitte versuche es gleich erneut.",
  })[code];
  const searchPlace = async () => {
    setLoading("place");
    setResearchMessage("");
    const result = await searchGooglePlaceAction(data.placeMapsUrl);
    setLoading(null);
    if (!result.ok) {
      setPlacePreviews([]);
      setSelectedPlace(null);
      setResearchMessage(errorMessage(result.code));
      return;
    }
    setPlacePreviews(result.places);
    setSelectedPlace(result.places.length === 1 ? result.places[0] : null);
    setResearchMessage(result.places.length > 1
      ? errorMessage("MULTIPLE_PLACES")
      : "Diese Angaben wurden aktuell von Google geladen und noch nicht dauerhaft gespeichert.");
  };
  const loadReviews = async (placeId = selectedPlace?.placeId || data.placeId) => {
    setLoading("reviews");
    setResearchMessage("");
    const result = await loadGoogleReviewsAction(placeId);
    setLoading(null);
    if (!result.ok) {
      setReviewPreviews([]);
      setResearchMessage(errorMessage(result.code));
      return [];
    }
    setReviewPreviews(result.reviews);
    setResearchMessage("Von Google geladene Rezensionen werden nur vorübergehend angezeigt.");
    return result.reviews;
  };
  const takePlace = (place: GooglePlacePreview) => {
    commit(props, {
      ...data,
      placeId: place.placeId,
      placeName: place.displayName,
      placeMapsUrl: place.googleMapsUri || data.placeMapsUrl,
      placeImportedOrEditedAt: new Date().toISOString(),
    });
    setSelectedPlace(place);
    setResearchMessage("Ortsname und erlaubte Referenzen wurden in die bearbeitbaren Quizfelder übernommen.");
  };
  const takeReview = (review: GoogleReviewPreview) => {
    const next = {
      id: crypto.randomUUID(),
      text: review.text,
      authorName: review.authorName,
      rating: review.rating,
      publishedLabel: review.publishedLabel,
      sourceUrl: review.sourceUrl,
      attributionText: review.attributionText,
      importedOrEditedAt: new Date().toISOString(),
    };
    const emptyIndex = data.reviews.findIndex((entry) => !entry.text.trim());
    updateReviews(emptyIndex >= 0
      ? data.reviews.map((entry, index) => index === emptyIndex ? next : entry)
      : [...data.reviews, next]);
    setResearchMessage("Die Rezension wurde in bearbeitbare Quizfelder übernommen.");
  };
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="font-semibold">Google-Rezensionen</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium sm:col-span-2">Google-Maps-Link zum Ort
        <input type="url" className={`${inputClass} mt-1 ${isAllowedGoogleMapsUrl(data.placeMapsUrl) ? "" : "border-red-500"}`} value={data.placeMapsUrl} disabled={props.disabled}
          onChange={(event) => commit(props, { ...data, placeMapsUrl: event.target.value, placeImportedOrEditedAt: new Date().toISOString() })} />
        {data.placeMapsUrl && isAllowedGoogleMapsUrl(data.placeMapsUrl) && <a className="mt-1 block text-xs text-blue-700 underline" href={data.placeMapsUrl} target="_blank" rel="noreferrer">Link öffnen</a>}
        {data.placeMapsUrl && !isAllowedGoogleMapsUrl(data.placeMapsUrl) && <span role="alert" className="mt-1 block text-xs text-red-700">Erlaubt sind HTTPS-Links von Google Maps oder maps.app.goo.gl.</span>}
      </label>
      {props.googlePlacesFeature.available && <>
        <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-3" disabled={props.disabled || loading !== null || !data.placeMapsUrl.trim()}
          onClick={searchPlace}>{loading === "place" ? "Google-Daten werden geladen …" : placePreviews.length ? "Google-Daten neu laden" : "Ort bei Google suchen"}</button>
        <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-3" disabled={props.disabled || loading !== null || !(selectedPlace?.placeId || data.placeId).trim()}
          onClick={() => loadReviews()}>{loading === "reviews" ? "Rezensionen werden geladen …" : "Rezensionen von Google laden"}</button>
        {researchMessage && <p role="status" className="text-sm text-slate-700 sm:col-span-2">{researchMessage}</p>}
        {placePreviews.length > 0 && <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:col-span-2">
          <h3 className="font-semibold">Temporäre Google-Vorschau</h3>
          {placePreviews.map((place) => <article key={place.placeId} className="rounded-lg bg-white p-3">
            <p className="font-semibold">{place.displayName || "Unbenannter Ort"}</p>
            <p className="text-sm">{place.formattedAddress}</p>
            <p className="text-sm">{place.rating === null ? "Keine Durchschnittsbewertung" : `${place.rating.toLocaleString("de-DE")} Sterne`}
              {place.userRatingCount !== null && ` · ${place.userRatingCount.toLocaleString("de-DE")} Rezensionen`}</p>
            <p className="text-xs text-slate-600">{place.attributionText}</p>
            <button type="button" className="mt-2 min-h-11 rounded-xl border border-slate-300 px-3" disabled={props.disabled}
              onClick={() => takePlace(place)}>Ortsname übernehmen</button>
          </article>)}
        </div>}
      </>}
      <label className="text-sm font-medium">Gesuchter Ort
        <input className={`${inputClass} mt-1`} value={data.placeName} disabled={props.disabled}
          onChange={(event) => commit(props, { ...data, placeName: event.target.value, placeImportedOrEditedAt: new Date().toISOString() })} />
      </label>
      <label className="text-sm font-medium">Zusatzangabe (optional)
        <input className={`${inputClass} mt-1`} value={data.placeAdditionalLabel} disabled={props.disabled}
          onChange={(event) => commit(props, { ...data, placeAdditionalLabel: event.target.value, placeImportedOrEditedAt: new Date().toISOString() })} />
      </label>
    </div>
    {props.googlePlacesFeature.available && reviewPreviews.length > 0 && <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <h3 className="font-semibold">Temporär geladene Rezensionen</h3>
      {reviewPreviews.map((review) => <article key={review.id} className="rounded-lg bg-white p-3">
        <p>{review.text}</p>
        <p className="mt-1 text-sm">
          {review.authorUri
            ? <a className="text-blue-700 underline" href={review.authorUri} target="_blank" rel="noreferrer">{review.authorName || "Google-Nutzer"}</a>
            : review.authorName || "Unbekannter Autor"}
          {review.rating !== null && ` · ${review.rating} ★`}{review.publishedLabel && ` · ${review.publishedLabel}`}
        </p>
        <p className="text-xs text-slate-600">{review.attributionText}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {review.sourceUrl && <a className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-blue-700 underline" href={review.sourceUrl} target="_blank" rel="noreferrer">Bei Google öffnen</a>}
          <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-3" disabled={props.disabled}
            onClick={() => takeReview(review)}>Als Quiz-Rezension übernehmen</button>
        </div>
      </article>)}
    </div>}
    {data.reviews.map((review, index) => <article key={review.id} className="space-y-3 rounded-xl bg-slate-50 p-3">
      <label className="block text-sm font-medium">Rezensionstext
      <textarea aria-label={`Rezension ${index + 1}`} rows={4} className={`${inputClass} mt-1`} value={review.text} disabled={props.disabled}
        onChange={(event) => updateReviews(data.reviews.map((entry) => entry.id === review.id ? { ...entry, text: event.target.value, importedOrEditedAt: new Date().toISOString() } : entry))} />
      </label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]">
        <label className="text-sm font-medium">Autor
          <input aria-label={`Autor ${index + 1}`} placeholder="optional" className={`${inputClass} mt-1`} value={review.authorName} disabled={props.disabled}
            onChange={(event) => updateReviews(data.reviews.map((entry) => entry.id === review.id ? { ...entry, authorName: event.target.value, importedOrEditedAt: new Date().toISOString() } : entry))} />
        </label>
        <label className="text-sm font-medium">Sterne
          <select aria-label={`Bewertung ${index + 1}`} className={`${inputClass} mt-1`} value={review.rating ?? ""} disabled={props.disabled}
            onChange={(event) => updateReviews(data.reviews.map((entry) => entry.id === review.id ? { ...entry, rating: event.target.value ? Number(event.target.value) : null, importedOrEditedAt: new Date().toISOString() } : entry))}>
            <option value="">–</option>
            {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} ★</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Datum/Zeitraum
          <input aria-label={`Datum oder Zeitraum ${index + 1}`} placeholder="optional" className={`${inputClass} mt-1`} value={review.publishedLabel} disabled={props.disabled}
            onChange={(event) => updateReviews(data.reviews.map((entry) => entry.id === review.id ? { ...entry, publishedLabel: event.target.value, importedOrEditedAt: new Date().toISOString() } : entry))} />
        </label>
      </div>
      <label className="block text-sm font-medium">Link zur Google-Rezension (optional)
        <input type="url" className={`${inputClass} mt-1 ${isAllowedGoogleMapsUrl(review.sourceUrl) ? "" : "border-red-500"}`} value={review.sourceUrl} disabled={props.disabled}
          onChange={(event) => updateReviews(data.reviews.map((entry) => entry.id === review.id ? { ...entry, sourceUrl: event.target.value, importedOrEditedAt: new Date().toISOString() } : entry))} />
        {review.sourceUrl && <span className="mt-1 flex flex-wrap gap-3 text-xs"><a className="text-blue-700 underline" href={review.sourceUrl} target="_blank" rel="noreferrer">Link öffnen</a>
          {props.googlePlacesFeature.available &&
          <button type="button" className="text-blue-700 underline" disabled={!data.placeId || loading !== null} onClick={async () => {
            const loadedReviews = await loadReviews(data.placeId);
            const match = findUniqueReviewBySourceUrl(loadedReviews, review.sourceUrl);
            setResearchMessage(match ? "Eine eindeutige Rezension wurde gefunden und kann oben übernommen werden." : errorMessage("REVIEW_NOT_UNIQUE"));
          }}>Rezension bei Google suchen</button>}</span>}
        {review.sourceUrl && !isAllowedGoogleMapsUrl(review.sourceUrl) && <span role="alert" className="mt-1 block text-xs text-red-700">Erlaubt sind HTTPS-Links von Google Maps oder maps.app.goo.gl.</span>}
      </label>
      <button type="button" aria-label={`Rezension ${index + 1} entfernen`} className="min-h-11 rounded-xl border border-red-200 px-3 text-sm text-red-700" disabled={props.disabled || data.reviews.length === 1}
        onClick={() => updateReviews(data.reviews.filter((entry) => entry.id !== review.id))}>Rezension entfernen</button>
    </article>)}
    <div className="flex flex-wrap gap-2">
      <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-3" disabled={props.disabled}
        onClick={() => updateReviews([...data.reviews, { id: crypto.randomUUID(), text: "", authorName: "", rating: null, publishedLabel: "", sourceUrl: "", attributionText: "", importedOrEditedAt: "" }])}>+ Rezension</button>
      <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-3" disabled={props.disabled || data.reviews.every((review) => !review.text.trim())}
        onClick={() => previewSpeech(data.reviews.map((review) => review.text).filter(Boolean).join(". "), 1)}>Rezensionen vorlesen</button>
    </div>
    <fieldset>
      <legend className="text-sm font-semibold">Darstellung</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {[
          { key: "sequentialReveal", label: "Nacheinander" },
          { key: "hideAuthorUntilSolution", label: "Autor später" },
          { key: "hideRatingUntilSolution", label: "Sterne später" },
        ].map((option) => {
          const key = option.key as "sequentialReveal" | "hideAuthorUntilSolution" | "hideRatingUntilSolution";
          const checked = data[key];
          return <Checkbox
            key={key}
            variant="card"
            label={option.label}
            checked={checked}
            disabled={props.disabled}
            title={{
              sequentialReveal: "Rezensionen einzeln aufdecken",
              hideAuthorUntilSolution: "Autor erst bei der Auflösung anzeigen",
              hideRatingUntilSolution: "Sterne erst bei der Auflösung anzeigen",
            }[key]}
            onChange={(event) => commit(props, {
              ...data,
              [key]: event.target.checked,
            })}
          />;
        })}
      </div>
    </fieldset>
    <details className="rounded-xl border border-slate-200 p-3" open={Boolean(data.explanation)}>
      <summary className="cursor-pointer text-sm font-semibold">Auflösung / Hintergrund hinzufügen</summary>
      <label className="mt-3 block text-sm font-medium">Auflösung / Hintergrund
        <textarea className={`${inputClass} mt-1`} value={data.explanation} disabled={props.disabled}
          onChange={(event) => commit(props, { ...data, explanation: event.target.value })} />
        <span className="mt-1 block text-xs font-normal text-slate-600">Wird bei der Auflösung angezeigt. Interne Hinweise gehören in die Moderationsnotizen.</span>
      </label>
    </details>
  </section>;
}

const editors: Partial<Record<QuestionTemplateSurfaceKind, ComponentType<EditorProps>>> = {
  TRUE_FALSE: TrueFalseEditor,
  ESTIMATE: EstimateEditor,
  ORDERING: OrderingEditor,
  TRANSLATION_READ_ALOUD: TranslationEditor,
  ANAGRAM: AnagramEditor,
  GOOGLE_REVIEWS: ReviewsEditor,
};

export function StructuredTemplateEditor({ kind, ...props }: Props) {
  const Editor = editors[kind];
  return Editor ? <Editor {...props} /> : null;
}
