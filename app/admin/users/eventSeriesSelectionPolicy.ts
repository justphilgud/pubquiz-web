import { normalizeEditorSearch } from "@/app/i18n/formatting";
import type { AppLocale } from "@/app/i18n/locale";

export type SelectableEventSeries = {
  id: number;
  name: string;
  archived: boolean;
};

export function filterEventSeries(
  eventSeries: readonly SelectableEventSeries[],
  input: { locale: AppLocale; query: string; showArchived: boolean },
) {
  const normalizedQuery = normalizeEditorSearch(input.locale, input.query);
  return eventSeries.filter(
    (series) =>
      (input.showArchived || !series.archived) &&
      normalizeEditorSearch(input.locale, series.name).includes(normalizedQuery),
  );
}

export function selectAllEventSeries(
  eventSeries: readonly SelectableEventSeries[],
  input: { includeArchived: boolean; unavailableIds?: readonly number[] },
) {
  const unavailableIds = new Set(input.unavailableIds ?? []);
  return eventSeries.flatMap((series) =>
    (input.includeArchived || !series.archived) && !unavailableIds.has(series.id)
      ? [series.id]
      : [],
  );
}
