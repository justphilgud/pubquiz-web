"use client";

import { useMemo, useState } from "react";
import { getStoryElementTypeLabel, STORY_ELEMENT_TYPES } from "@/app/story-elemente/storyElement";
import ContentSearchControls from "./ContentSearchControls";
import {
  normalizeContentFiltersForType,
  type ContentFilterOption,
  type ContentFiltersState,
} from "./contentLibrary";

export default function ContentFilters({ filters, categories, eventSeries, loading, onChange, onApply, onReset }: {
  filters: ContentFiltersState;
  categories: ContentFilterOption[];
  eventSeries: ContentFilterOption[];
  loading: boolean;
  onChange: (filters: ContentFiltersState) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const filterCount = [filters.contentType !== "ALL", filters.categoryIds.length > 0, filters.storyType !== "ALL", filters.status !== "ALL", filters.questionLifecycle !== "ALL", filters.media !== "ALL", filters.usage !== "ALL", filters.eventSeriesId !== null].filter(Boolean).length;
  const [open, setOpen] = useState(filterCount > 0);
  const [categoryQuery, setCategoryQuery] = useState("");
  const visibleCategories = useMemo(() => {
    const normalizedQuery = categoryQuery.trim().toLocaleLowerCase("de");
    return normalizedQuery
      ? categories.filter((category) =>
          category.name.toLocaleLowerCase("de").includes(normalizedQuery),
        )
      : categories;
  }, [categories, categoryQuery]);
  const inputClass = "min-h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <ContentSearchControls query={filters.query} loading={loading} placeholder="Fragen, Story-Elemente und Umfragen durchsuchen …" filterCount={filterCount} filtersOpen={open}
        onQueryChange={(query) => onChange({ ...filters, query })} onSubmit={onApply} onToggleFilters={() => setOpen((value) => !value)} onReset={onReset}>
        <div className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-5">
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Inhaltstyp</span><select value={filters.contentType} onChange={(event) => onChange(normalizeContentFiltersForType({ ...filters, contentType: event.target.value as ContentFiltersState["contentType"] }))} className={inputClass}><option value="ALL">Alle Inhalte</option><option value="QUESTION">Fragen</option><option value="STORY_ELEMENT">Story-Elemente</option><option value="POLL">Umfragen</option></select></label>
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Status</span><select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value as ContentFiltersState["status"] })} className={inputClass}><option value="ALL">Alle Status</option><option value="DRAFT">Entwurf</option><option value="ACTIVE">Aktiv / freigegeben</option><option value="ARCHIVED">Archiviert</option></select></label>
          {(filters.contentType === "QUESTION" || filters.contentType === "ALL") && <label><span className="mb-1 block text-xs font-bold text-slate-600">Aktualität</span><select value={filters.questionLifecycle} onChange={(event) => onChange({ ...filters, questionLifecycle: event.target.value as ContentFiltersState["questionLifecycle"] })} className={inputClass}><option value="ALL">Alle</option><option value="CURRENT">Aktuell</option><option value="OUTDATED_SOON">Bald veraltet</option><option value="OUTDATED">Veraltet</option><option value="REVIEW_SOON">Prüfung demnächst</option><option value="REVIEW_DUE">Prüfung fällig</option></select></label>}
          {(filters.contentType === "QUESTION" || filters.contentType === "ALL") && <details className="relative self-end rounded-xl border border-slate-300 bg-white">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold text-slate-800">
              <span>{filters.categoryIds.length === 0 ? "Alle Kategorien" : `${filters.categoryIds.length} Kategorien`}</span>
              <span aria-hidden="true">▾</span>
            </summary>
            <fieldset className="absolute z-20 mt-1 max-h-72 min-w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:w-72">
              <legend className="sr-only">Kategorien</legend>
              <label className="mb-2 block">
                <span className="sr-only">Kategorien suchen</span>
                <input type="search" value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="Kategorien suchen …" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
              </label>
              {filters.categoryIds.length > 0 && <button type="button" onClick={() => onChange({ ...filters, categoryIds: [] })} className="mb-1 min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Alle zurücksetzen</button>}
              {visibleCategories.map((category) => <label key={category.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={filters.categoryIds.includes(category.id)} onChange={() => onChange({ ...filters, categoryIds: filters.categoryIds.includes(category.id) ? filters.categoryIds.filter((id) => id !== category.id) : [...filters.categoryIds, category.id] })} className="size-4 accent-slate-950" />
                <span>{category.name}</span>
              </label>)}
              {visibleCategories.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">Keine passende Kategorie gefunden.</p>}
            </fieldset>
          </details>}
          {(filters.contentType === "STORY_ELEMENT" || filters.contentType === "ALL") && <label><span className="mb-1 block text-xs font-bold text-slate-600">Story-Typ</span><select value={filters.storyType} onChange={(event) => onChange({ ...filters, storyType: event.target.value })} className={inputClass}><option value="ALL">Alle Story-Typen</option>{STORY_ELEMENT_TYPES.map((type) => <option key={type} value={type}>{getStoryElementTypeLabel(type)}</option>)}</select></label>}
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Medien</span><select value={filters.media} onChange={(event) => onChange({ ...filters, media: event.target.value as ContentFiltersState["media"] })} className={inputClass}><option value="ALL">Alle</option><option value="WITH">Mit Medien</option><option value="WITHOUT">Ohne Medien</option></select></label>
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Quiz-Verwendung</span><select value={filters.usage} onChange={(event) => onChange({ ...filters, usage: event.target.value as ContentFiltersState["usage"] })} className={inputClass}><option value="ALL">Alle</option><option value="USED">Verwendet</option><option value="UNUSED">Unbenutzt</option></select></label>
          {eventSeries.length > 1 && <label><span className="mb-1 block text-xs font-bold text-slate-600">Eventreihe</span><select value={filters.eventSeriesId ?? ""} onChange={(event) => onChange({ ...filters, eventSeriesId: Number(event.target.value) || null })} className={inputClass}><option value="">Alle Eventreihen</option>{eventSeries.map((series) => <option key={series.id} value={series.id}>{series.name}</option>)}</select></label>}
          <button type="button" onClick={onApply} className="min-h-11 self-end rounded-xl border border-slate-300 bg-white px-4 font-semibold xl:col-start-5">Filter anwenden</button>
        </div>
      </ContentSearchControls>
    </div>
  );
}
