"use client";

import { useState } from "react";
import { getStoryElementTypeLabel, STORY_ELEMENT_TYPES } from "@/app/story-elemente/storyElement";
import ContentSearchControls from "./ContentSearchControls";
import type { ContentFiltersState } from "./contentLibrary";

export default function ContentFilters({ filters, loading, onChange, onApply, onReset }: {
  filters: ContentFiltersState;
  loading: boolean;
  onChange: (filters: ContentFiltersState) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const filterCount = [filters.contentType !== "ALL", filters.storyType !== "ALL", filters.status !== "ALL", filters.media !== "ALL", filters.usage !== "ALL"].filter(Boolean).length;
  const [open, setOpen] = useState(filterCount > 0);
  const inputClass = "min-h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <ContentSearchControls query={filters.query} loading={loading} placeholder="Fragen und Story-Elemente durchsuchen …" filterCount={filterCount} filtersOpen={open}
        onQueryChange={(query) => onChange({ ...filters, query })} onSubmit={onApply} onToggleFilters={() => setOpen((value) => !value)} onReset={onReset}>
        <div className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-5">
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Inhaltstyp</span><select value={filters.contentType} onChange={(event) => onChange({ ...filters, contentType: event.target.value as ContentFiltersState["contentType"] })} className={inputClass}><option value="ALL">Alle Inhalte</option><option value="QUESTION">Fragen</option><option value="STORY_ELEMENT">Story-Elemente</option></select></label>
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Status</span><select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value as ContentFiltersState["status"] })} className={inputClass}><option value="ALL">Alle Status</option><option value="DRAFT">Entwurf</option><option value="ACTIVE">Aktiv / freigegeben</option><option value="ARCHIVED">Archiviert</option></select></label>
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Story-Typ</span><select value={filters.storyType} disabled={filters.contentType === "QUESTION"} onChange={(event) => onChange({ ...filters, storyType: event.target.value })} className={inputClass}><option value="ALL">Alle Story-Typen</option>{STORY_ELEMENT_TYPES.map((type) => <option key={type} value={type}>{getStoryElementTypeLabel(type)}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Medien</span><select value={filters.media} onChange={(event) => onChange({ ...filters, media: event.target.value as ContentFiltersState["media"] })} className={inputClass}><option value="ALL">Alle</option><option value="WITH">Mit Medien</option><option value="WITHOUT">Ohne Medien</option></select></label>
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Quiz-Verwendung</span><select value={filters.usage} onChange={(event) => onChange({ ...filters, usage: event.target.value as ContentFiltersState["usage"] })} className={inputClass}><option value="ALL">Alle</option><option value="USED">Verwendet</option><option value="UNUSED">Unbenutzt</option></select></label>
          <button type="button" onClick={onApply} className="min-h-11 self-end rounded-xl border border-slate-300 bg-white px-4 font-semibold xl:col-start-5">Filter anwenden</button>
        </div>
      </ContentSearchControls>
    </div>
  );
}
