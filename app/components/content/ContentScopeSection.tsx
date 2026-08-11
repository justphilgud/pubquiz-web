"use client";

import { useId, useMemo, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";

export type ContentScopeValue = "GLOBAL" | "EVENT_SERIES" | "QUIZ";
export type ContentScopeEventSeriesOption = { id: number; name: string };
export type ContentScopeQuizOption = {
  id: number;
  title: string;
  eventSeriesId: number;
  eventSeriesName: string;
};

type ScopeLabels = {
  title: string;
  global: string;
  eventSeries: string;
  quiz: string;
  globalHelp: string;
  eventSeriesHelp: string;
  quizHelp: string;
  eventSeriesSearch: string;
  eventSeriesEmpty: string;
  eventSeriesRequired: string;
  quizRequired: string;
  remove: string;
};

const defaultLabels: ScopeLabels = {
  title: "Geltungsbereich",
  global: "Global",
  eventSeries: "Eventreihe",
  quiz: "Nur dieses Quiz",
  globalHelp: "Dieser Inhalt kann in allen Eventreihen verwendet werden.",
  eventSeriesHelp: "Dieser Inhalt kann nur in den ausgewählten Eventreihen verwendet werden.",
  quizHelp: "Dieser Inhalt kann nur in dem ausgewählten Quiz verwendet werden.",
  eventSeriesSearch: "Eventreihe suchen",
  eventSeriesEmpty: "Keine passende Eventreihe gefunden.",
  eventSeriesRequired: "Wähle mindestens eine Eventreihe aus.",
  quizRequired: "Wähle ein Quiz aus.",
  remove: "entfernen",
};

export default function ContentScopeSection({
  scope,
  eventSeriesIds,
  eventSeries,
  availableScopes = ["GLOBAL", "EVENT_SERIES"],
  quizzes = [],
  quizId = null,
  multipleEventSeries = true,
  disabled,
  labels: labelOverrides,
  onChange,
}: {
  scope: ContentScopeValue;
  eventSeriesIds: number[];
  eventSeries: ContentScopeEventSeriesOption[];
  availableScopes?: ContentScopeValue[];
  quizzes?: ContentScopeQuizOption[];
  quizId?: number | null;
  multipleEventSeries?: boolean;
  disabled?: boolean;
  labels?: Partial<ScopeLabels>;
  onChange: (value: {
    scope: ContentScopeValue;
    eventSeriesIds: number[];
    quizId: number | null;
  }) => void;
}) {
  const labels = { ...defaultLabels, ...labelOverrides };
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedEventSeries = eventSeries.filter((series) =>
    eventSeriesIds.includes(series.id),
  );
  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("de");
    return normalizedQuery
      ? eventSeries.filter((series) =>
          series.name.toLocaleLowerCase("de").includes(normalizedQuery),
        )
      : eventSeries;
  }, [eventSeries, query]);
  const { containerRef, triggerRef } =
    useDismissiblePopover<HTMLInputElement>({
      open: isOpen,
      onClose: () => setIsOpen(false),
    });

  function selectScope(nextScope: ContentScopeValue) {
    setIsOpen(false);
    setQuery("");
    onChange({
      scope: nextScope,
      eventSeriesIds:
        nextScope === "EVENT_SERIES" && eventSeriesIds.length === 0 && eventSeries.length === 1
          ? [eventSeries[0].id]
          : eventSeriesIds,
      quizId,
    });
  }

  function toggleEventSeries(seriesId: number) {
    const nextIds = eventSeriesIds.includes(seriesId)
      ? eventSeriesIds.filter((id) => id !== seriesId)
      : multipleEventSeries
        ? [...eventSeriesIds, seriesId]
        : [seriesId];
    onChange({ scope: "EVENT_SERIES", eventSeriesIds: nextIds, quizId });
    if (!multipleEventSeries) {
      setIsOpen(false);
      setQuery("");
    }
  }

  return (
    <fieldset
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      disabled={disabled}
    >
      <legend className="px-2 font-semibold text-slate-950">{labels.title}</legend>
      <div
        role="radiogroup"
        aria-label={labels.title}
        className="mt-3 grid gap-1 rounded-xl border border-slate-300 bg-slate-50 p-1 sm:grid-flow-col sm:auto-cols-fr"
      >
        {availableScopes.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={scope === value}
            onClick={() => selectScope(value)}
            className={[
              "min-h-11 rounded-lg px-3 py-2 text-sm font-semibold",
              scope === value
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-700 hover:bg-white",
            ].join(" ")}
          >
            {value === "GLOBAL"
              ? labels.global
              : value === "EVENT_SERIES"
                ? labels.eventSeries
                : labels.quiz}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {scope === "GLOBAL"
          ? labels.globalHelp
          : scope === "EVENT_SERIES"
            ? labels.eventSeriesHelp
            : labels.quizHelp}
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
                  aria-label={`${series.name} ${labels.remove}`}
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
                    Math.min(current + 1, Math.max(matches.length - 1, 0)),
                  );
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((current) => Math.max(current - 1, 0));
                } else if (event.key === "Enter" && matches[activeIndex]) {
                  event.preventDefault();
                  toggleEventSeries(matches[activeIndex].id);
                }
              }}
              placeholder={labels.eventSeriesSearch}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            {isOpen && (
              <div
                id={listboxId}
                role="listbox"
                aria-multiselectable={multipleEventSeries}
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
                        activeIndex === index ? "bg-slate-100" : "hover:bg-slate-100",
                      ].join(" ")}
                    >
                      <span>{series.name}</span>
                      <span aria-hidden="true">{selected ? "✓" : "+"}</span>
                    </button>
                  );
                })}
                {matches.length === 0 && (
                  <p className="px-3 py-3 text-sm text-slate-500">
                    {labels.eventSeriesEmpty}
                  </p>
                )}
              </div>
            )}
          </div>
          {eventSeriesIds.length === 0 && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {labels.eventSeriesRequired}
            </p>
          )}
        </div>
      )}

      {scope === "QUIZ" && (
        <div className="mt-3">
          <select
            aria-label={labels.quiz}
            value={quizId ?? ""}
            onChange={(event) => {
              const nextQuizId = Number(event.target.value) || null;
              const selectedQuiz = quizzes.find((quiz) => quiz.id === nextQuizId);
              onChange({
                scope: "QUIZ",
                quizId: nextQuizId,
                eventSeriesIds: selectedQuiz ? [selectedQuiz.eventSeriesId] : eventSeriesIds,
              });
            }}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">Quiz auswählen</option>
            {quizzes.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title} · {quiz.eventSeriesName}
              </option>
            ))}
          </select>
          {quizId === null && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {labels.quizRequired}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
