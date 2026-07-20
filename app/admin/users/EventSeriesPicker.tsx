"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatMessage } from "@/app/i18n/formatMessage";
import type { AppLocale } from "@/app/i18n/locale";
import type { RoleMessages } from "@/app/i18n/roleMessages";
import {
  filterEventSeries,
  selectAllEventSeries,
  type SelectableEventSeries,
} from "./eventSeriesSelectionPolicy";

type Props = {
  eventSeries: readonly SelectableEventSeries[];
  selectedIds: readonly number[];
  unavailableIds?: readonly number[];
  onChange: (ids: number[]) => void;
  inputName: string;
  label: string;
  locale: AppLocale;
  messages: RoleMessages;
};

export function EventSeriesPicker({
  eventSeries,
  selectedIds,
  unavailableIds = [],
  onChange,
  inputName,
  label,
  locale,
  messages,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const unavailable = useMemo(() => new Set(unavailableIds), [unavailableIds]);
  const selected = useMemo(
    () => eventSeries.filter((series) => selectedIds.includes(series.id)),
    [eventSeries, selectedIds],
  );
  const visible = useMemo(
    () => filterEventSeries(eventSeries, { locale, query, showArchived }),
    [eventSeries, locale, query, showArchived],
  );

  function toggle(id: number) {
    if (unavailable.has(id)) return;
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  }

  function selectAll(includeArchived: boolean) {
    const matchingIds = selectAllEventSeries(eventSeries, {
      includeArchived,
      unavailableIds,
    });
    onChange([...new Set([...selectedIds, ...matchingIds])]);
    if (includeArchived) setShowArchived(true);
  }

  return (
    <div className="min-w-0">
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={inputName} value={id} />
      ))}

      <div className="flex min-w-0 flex-wrap gap-2">
        {selected.map((series) => (
          <button
            key={series.id}
            type="button"
            onClick={() => toggle(series.id)}
            aria-label={formatMessage(messages.eventSeriesPicker.remove, {
              name: series.name,
            })}
            className="flex min-h-10 max-w-full items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800"
          >
            <span className="min-w-0 truncate">{series.name}</span>
            {series.archived && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                {messages.status.archived}
              </span>
            )}
            <span aria-hidden="true" className="shrink-0">{"\u00d7"}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className="mt-2 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:border-slate-500"
      >
        {label}
      </button>

      <p className="mt-2 text-xs text-slate-500">
        {formatMessage(messages.eventSeriesPicker.selected, {
          count: selectedIds.length,
        })}
      </p>

      <Modal
        open={open}
        title={label}
        onClose={() => setOpen(false)}
        footer={
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 rounded-xl bg-slate-950 px-4 py-2 font-medium text-white"
          >
            {messages.eventSeriesPicker.done}
          </button>
        }
      >
        <div className="flex max-h-[calc(100dvh-12rem)] min-h-0 flex-col">
          <label className="block shrink-0">
            <span className="text-sm font-medium text-slate-900">
              {messages.eventSeriesPicker.searchLabel}
            </span>
            <SearchInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={messages.eventSeriesPicker.searchPlaceholder}
              className="mt-2 min-h-11 rounded-xl border-slate-300 px-4 py-3"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => selectAll(false)} className="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium">
              {messages.eventSeriesPicker.selectAllActive}
            </button>
            <button type="button" onClick={() => selectAll(true)} className="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium">
              {messages.eventSeriesPicker.selectAll}
            </button>
            <button type="button" onClick={() => setShowArchived((value) => !value)} className="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium">
              {showArchived
                ? messages.eventSeriesPicker.hideArchived
                : messages.eventSeriesPicker.showArchived}
            </button>
          </div>

          <div className="mt-4 grid min-h-0 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {visible.map((series) => {
              const isSelected = selectedIds.includes(series.id);
              const isUnavailable = unavailable.has(series.id);
              return (
                <button
                  key={series.id}
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => toggle(series.id)}
                  aria-pressed={isSelected}
                  className={[
                    "flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
                    isSelected
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:border-slate-500",
                  ].join(" ")}
                >
                  <span className="min-w-0 truncate">{series.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {series.archived && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                        {messages.status.archived}
                      </span>
                    )}
                    <span aria-hidden="true">{isSelected ? "\u2713" : "+"}</span>
                  </span>
                </button>
              );
            })}
            {visible.length === 0 && (
              <p className="py-3 text-sm text-slate-500">
                {messages.eventSeriesPicker.notFound}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
