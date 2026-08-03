"use client";

import type { ReactNode } from "react";

type Props = {
  query: string;
  loading?: boolean;
  placeholder: string;
  searchLabel?: string;
  filterCount?: number;
  filtersOpen?: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onToggleFilters?: () => void;
  onReset?: () => void;
  children?: ReactNode;
};

/**
 * Shared interaction shell for content searches. Domain-specific filters and
 * result rendering deliberately stay with Questions and Story Elements.
 */
export default function ContentSearchControls({
  query,
  loading = false,
  placeholder,
  searchLabel = "Suchen",
  filterCount = 0,
  filtersOpen = false,
  onQueryChange,
  onSubmit,
  onToggleFilters,
  onReset,
  children,
}: Props) {
  return (
    <>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          aria-label="Suchtext"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Suche läuft …" : searchLabel}
        </button>
      </form>

      {(onToggleFilters || (filterCount > 0 && onReset)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onToggleFilters && (
            <button
              type="button"
              aria-expanded={filtersOpen}
              onClick={onToggleFilters}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold"
            >
              Filter{filterCount > 0 ? ` (${filterCount})` : ""}
            </button>
          )}
          {filterCount > 0 && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {filtersOpen && children}
    </>
  );
}
