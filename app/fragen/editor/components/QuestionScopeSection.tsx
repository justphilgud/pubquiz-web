"use client";

import { useId, useMemo, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
import type { QuestionEditorDraft } from "../types";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

export type QuestionScopeOption = { id: number; name: string };

export function QuestionScopeSection({
  scope,
  eventSeriesIds,
  eventSeries,
  canSelectGlobal,
  onChange,
}: {
  scope: QuestionEditorDraft["scope"];
  eventSeriesIds: number[];
  eventSeries: QuestionScopeOption[];
  canSelectGlobal: boolean;
  onChange: (
    scope: QuestionEditorDraft["scope"],
    eventSeriesIds: number[],
  ) => void;
}) {
  const { locale, messages } = useQuestionEditorMessages();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedEventSeries = eventSeries.filter((series) =>
    eventSeriesIds.includes(series.id),
  );
  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return normalizedQuery
      ? eventSeries.filter((series) =>
          series.name.toLocaleLowerCase(locale).includes(normalizedQuery),
        )
      : eventSeries;
  }, [eventSeries, locale, query]);
  const { containerRef, triggerRef } =
    useDismissiblePopover<HTMLInputElement>({
      open: isOpen,
      onClose: () => setIsOpen(false),
    });

  function toggleEventSeries(seriesId: number) {
    onChange(
      "EVENT_SERIES",
      eventSeriesIds.includes(seriesId)
        ? eventSeriesIds.filter((id) => id !== seriesId)
        : [...eventSeriesIds, seriesId],
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <fieldset>
        <legend className="font-semibold text-slate-950">
          {messages.editor.scopeTitle}
        </legend>
        <div
          role="radiogroup"
          aria-label={messages.editor.scopeTitle}
          className="mt-3 grid grid-cols-2 rounded-xl border border-slate-300 bg-slate-50 p-1"
        >
          {(canSelectGlobal || scope === "GLOBAL") && (
            <button
              type="button"
              role="radio"
              aria-checked={scope === "GLOBAL"}
              disabled={!canSelectGlobal}
              onClick={() => {
                setIsOpen(false);
                setQuery("");
                onChange("GLOBAL", eventSeriesIds);
              }}
              className={[
                "min-h-11 rounded-lg px-3 py-2 text-sm font-semibold",
                scope === "GLOBAL"
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-700 hover:bg-white",
              ].join(" ")}
            >
              {messages.editor.scopeGlobal}
            </button>
          )}
          <button
            type="button"
            role="radio"
            aria-checked={scope === "EVENT_SERIES"}
            onClick={() =>
              onChange(
                "EVENT_SERIES",
                eventSeriesIds.length
                  ? eventSeriesIds
                  : eventSeries.length === 1
                    ? [eventSeries[0].id]
                    : [],
              )
            }
            className={[
              "min-h-11 rounded-lg px-3 py-2 text-sm font-semibold",
              scope === "EVENT_SERIES"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-700 hover:bg-white",
              !canSelectGlobal && scope !== "GLOBAL" ? "col-span-2" : "",
            ].join(" ")}
          >
            {messages.editor.scopeEventSeries}
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {scope === "GLOBAL"
            ? messages.editor.scopeGlobalHelp
            : messages.editor.scopeEventSeriesHelp}
        </p>

        {scope === "EVENT_SERIES" && (
          <div ref={containerRef} className="mt-3">
            {selectedEventSeries.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedEventSeries.map((series) => (
                  <button
                    key={series.id}
                    type="button"
                    onClick={() => toggleEventSeries(series.id)}
                    className="min-h-9 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800"
                    aria-label={`${series.name} ${messages.common.remove}`}
                  >
                    {series.name} ×
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                ref={triggerRef}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                value={query}
                onFocus={() => setIsOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                  setIsOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setIsOpen(true);
                    setActiveIndex((current) =>
                      Math.min(
                        current + 1,
                        Math.max(matches.length - 1, 0),
                      ),
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((current) => Math.max(current - 1, 0));
                  } else if (event.key === "Enter" && matches[activeIndex]) {
                    event.preventDefault();
                    toggleEventSeries(matches[activeIndex].id);
                  }
                }}
                placeholder={messages.editor.scopeEventSeriesSearch}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              {isOpen && (
                <div
                  id={listboxId}
                  role="listbox"
                  aria-multiselectable="true"
                  className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                >
                  {matches.map((series, index) => {
                    const selected = eventSeriesIds.includes(series.id);
                    return (
                      <button
                        key={series.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onPointerMove={() => setActiveIndex(index)}
                        onClick={() => toggleEventSeries(series.id)}
                        className={[
                          "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm",
                          activeIndex === index
                            ? "bg-slate-100"
                            : "hover:bg-slate-100",
                        ].join(" ")}
                      >
                        <span>{series.name}</span>
                        <span aria-hidden="true">{selected ? "✓" : "+"}</span>
                      </button>
                    );
                  })}
                  {matches.length === 0 && (
                    <p className="px-3 py-3 text-sm text-slate-500">
                      {messages.editor.scopeEventSeriesEmpty}
                    </p>
                  )}
                </div>
              )}
            </div>
            {eventSeriesIds.length === 0 && (
              <p role="alert" className="mt-2 text-sm font-medium text-red-700">
                {messages.editor.scopeRequired}
              </p>
            )}
          </div>
        )}
      </fieldset>
    </section>
  );
}
