"use client";

import { useState } from "react";
import {
  countAdvancedQuestionFilters,
  type QuestionOverviewFilters,
  type QuestionOverviewStatus,
} from "../questionOverviewFilters";
import {
  CategoryFilterCombobox,
  type QuestionFilterCategory,
} from "./CategoryFilterCombobox";
import { TemplateFilterCombobox } from "./TemplateFilterCombobox";
import ContentSearchControls from "@/app/components/content/ContentSearchControls";

const statusShortcuts = [
  ["MY_DRAFTS", "Meine Entwürfe"],
  ["MY_SUBMITTED", "Zur Prüfung"],
  ["REVIEW_QUEUE", "Zur Freigabe"],
  ["CHANGES_REQUESTED", "Überarbeitung"],
] as const;

const additionalStatuses = [
  ["APPROVED", "Freigegeben"],
  ["ARCHIVED", "Archiviert"],
  ["OUTDATED", "Veraltet"],
] as const;

const toggleClass = (active: boolean) =>
  [
    "min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold",
    active
      ? "border-slate-950 bg-slate-950 text-white"
      : "border-slate-300 bg-white text-slate-700",
  ].join(" ");

function SegmentedFilter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: ReadonlyArray<{ value: T | null; label: string }>;
  onChange: (value: T | null) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-1 grid grid-cols-3 rounded-xl border border-slate-300 bg-white p-1">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={[
              "min-h-10 rounded-lg px-2 py-1.5 text-sm font-medium",
              value === option.value
                ? "bg-slate-950 text-white"
                : "text-slate-700 hover:bg-slate-100",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function QuestionOverviewControls({
  filters,
  categories,
  templates,
  statusCounts,
  query,
  loading,
  onQueryChange,
  onApplySearch,
  onChange,
  onReset,
}: {
  filters: QuestionOverviewFilters;
  categories: QuestionFilterCategory[];
  templates: Array<{ id: string; name: string }>;
  statusCounts: Partial<
    Record<
      "MY_DRAFTS" | "MY_SUBMITTED" | "REVIEW_QUEUE" | "CHANGES_REQUESTED",
      number
    >
  >;
  query: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onApplySearch: () => void;
  onChange: (filters: QuestionOverviewFilters) => void;
  onReset: () => void;
}) {
  const activeAdvancedCount = countAdvancedQuestionFilters(filters);
  const [open, setOpen] = useState(activeAdvancedCount > 0);
  const selectedCategory = categories.find(
    (category) => category.fragenkategorie_id === filters.categoryId,
  );

  function toggleStatus(status: QuestionOverviewStatus) {
    onChange({
      ...filters,
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((current) => current !== status)
        : [...filters.statuses, status],
    });
  }

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusShortcuts.flatMap(([status, label]) =>
          statusCounts[status] === undefined
            ? []
            : [
                <button
                  key={status}
                  type="button"
                  aria-pressed={filters.statuses.includes(status)}
                  onClick={() => toggleStatus(status)}
                  className={`${toggleClass(filters.statuses.includes(status))} shrink-0 rounded-full`}
                >
                  {label}{" "}
                  <span className="ml-1 rounded-full bg-white/20 px-1.5">
                    {statusCounts[status]}
                  </span>
                </button>,
              ],
        )}
      </div>

      <div className="mt-3">
        <ContentSearchControls
          query={query}
          loading={loading}
          placeholder="Fragen durchsuchen …"
          filterCount={activeAdvancedCount}
          filtersOpen={open}
          onQueryChange={onQueryChange}
          onSubmit={onApplySearch}
          onToggleFilters={() => setOpen((current) => !current)}
          onReset={onReset}
        >
          <div className="mt-3 grid gap-4 rounded-2xl bg-slate-50 p-3 md:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-medium">Weitere Status</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {additionalStatuses.map(([status, label]) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={filters.statuses.includes(status)}
                    onClick={() => toggleStatus(status)}
                    className={toggleClass(filters.statuses.includes(status))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <TemplateFilterCombobox
              templates={templates}
              value={filters.templateIds}
              onChange={(templateIds) => onChange({ ...filters, templateIds })}
            />

            <CategoryFilterCombobox
              categories={categories}
              value={filters.categoryId}
              onChange={(categoryId) => onChange({ ...filters, categoryId })}
            />

            <SegmentedFilter
              label="Quelle"
              value={filters.sourceState}
              options={[
                { value: null, label: "Alle" },
                { value: "with", label: "Mit Quelle" },
                { value: "without", label: "Ohne Quelle" },
              ]}
              onChange={(sourceState) => onChange({ ...filters, sourceState })}
            />

            <SegmentedFilter
              label="Medien"
              value={filters.mediaState}
              options={[
                { value: null, label: "Alle" },
                { value: "with", label: "Mit Medien" },
                { value: "without", label: "Ohne Medien" },
              ]}
              onChange={(mediaState) => onChange({ ...filters, mediaState })}
            />

            <SegmentedFilter
              label="Antwortart"
              value={filters.answerMode}
              options={[
                { value: null, label: "Alle" },
                { value: "open", label: "Offen" },
                { value: "closed", label: "Geschlossen" },
              ]}
              onChange={(answerMode) => onChange({ ...filters, answerMode })}
            />
          </div>
        </ContentSearchControls>
      </div>
      {activeAdvancedCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Aktive Filter">
          {additionalStatuses.flatMap(([status, label]) =>
            filters.statuses.includes(status)
              ? [
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className="min-h-10 rounded-full bg-slate-100 px-3 py-1.5 text-sm"
                  >
                    {label} ×
                  </button>,
                ]
              : [],
          )}
          {filters.templateIds.map((templateId) => (
            <button
              key={templateId}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  templateIds: filters.templateIds.filter(
                    (current) => current !== templateId,
                  ),
                })
              }
              className="min-h-10 rounded-full bg-slate-100 px-3 py-1.5 text-sm"
            >
              {templates.find((template) => template.id === templateId)?.name ??
                templateId}{" "}
              ×
            </button>
          ))}
          {selectedCategory && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, categoryId: null })}
              className="min-h-10 rounded-full bg-slate-100 px-3 py-1.5 text-sm"
            >
              {selectedCategory.kategorie} ×
            </button>
          )}
          {filters.sourceState && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, sourceState: null })}
              className="min-h-10 rounded-full bg-slate-100 px-3 py-1.5 text-sm"
            >
              Quelle: {filters.sourceState === "with" ? "vorhanden" : "fehlt"} ×
            </button>
          )}
          {filters.mediaState && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, mediaState: null })}
              className="min-h-10 rounded-full bg-slate-100 px-3 py-1.5 text-sm"
            >
              Medien: {filters.mediaState === "with" ? "vorhanden" : "fehlen"} ×
            </button>
          )}
          {filters.answerMode && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, answerMode: null })}
              className="min-h-10 rounded-full bg-slate-100 px-3 py-1.5 text-sm"
            >
              Antwortart: {filters.answerMode === "open" ? "Offen" : "Geschlossen"} ×
            </button>
          )}
        </div>
      )}

    </>
  );
}
