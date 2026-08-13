"use client";

import { useId, useMemo, useState, type ReactNode } from "react";

import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";

export type CreatableMultiSelectOption<Id extends string | number> = {
  id: Id;
  label: string;
};

export type CreatableMultiSelectCreateResult<Id extends string | number> =
  | { ok: true; option: CreatableMultiSelectOption<Id> }
  | { ok: false; message: string };

type Props<Id extends string | number> = {
  label: string;
  helpText?: string;
  options: readonly CreatableMultiSelectOption<Id>[];
  selectedIds: readonly Id[];
  onChange: (ids: Id[]) => void;
  placeholder: string;
  emptyMessage: string;
  clearAllLabel: string;
  locale?: string;
  maxLength?: number;
  filterOptions?: (
    options: readonly CreatableMultiSelectOption<Id>[],
    query: string,
  ) => readonly CreatableMultiSelectOption<Id>[];
  getOptionDescription?: (
    option: CreatableMultiSelectOption<Id>,
    query: string,
  ) => ReactNode;
  getSelectedOptionAnnotation?: (
    option: CreatableMultiSelectOption<Id>,
  ) => ReactNode;
  getRemoveLabel?: (option: CreatableMultiSelectOption<Id>) => string;
  getSearchHint?: (
    query: string,
    matches: readonly CreatableMultiSelectOption<Id>[],
  ) => ReactNode;
  create?: {
    normalize: (query: string) => string;
    isValid: (query: string) => boolean;
    label: (query: string) => string;
    duplicateMessage: (existingLabel: string) => string;
    onCreate: (
      query: string,
    ) => Promise<CreatableMultiSelectCreateResult<Id>>;
    pendingLabel: string;
  };
};

export function normalizeMultiSelectComparisonKey(
  value: string,
  locale = "de-DE",
) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase(locale);
}

function defaultFilter<Id extends string | number>(
  options: readonly CreatableMultiSelectOption<Id>[],
  query: string,
  locale: string,
) {
  const key = normalizeMultiSelectComparisonKey(query, locale);
  return [...options]
    .filter((option) =>
      normalizeMultiSelectComparisonKey(option.label, locale).includes(key),
    )
    .sort((left, right) => left.label.localeCompare(right.label, locale));
}

export function CreatableMultiSelect<Id extends string | number>({
  label,
  helpText,
  options,
  selectedIds,
  onChange,
  placeholder,
  emptyMessage,
  clearAllLabel,
  locale = "de-DE",
  maxLength = 100,
  filterOptions,
  getOptionDescription,
  getSelectedOptionAnnotation,
  getRemoveLabel,
  getSearchHint,
  create,
}: Props<Id>) {
  const inputId = useId();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { containerRef, triggerRef } =
    useDismissiblePopover<HTMLInputElement>({
      open: isOpen,
      onClose: () => setIsOpen(false),
    });

  const selectedOptions = useMemo(
    () => options.filter((option) => selectedIds.includes(option.id)),
    [options, selectedIds],
  );
  const matches = useMemo(
    () =>
      filterOptions
        ? filterOptions(options, query)
        : defaultFilter(options, query, locale),
    [filterOptions, locale, options, query],
  );
  const normalizedCreateQuery = create?.normalize(query) ?? query.trim();
  const exactOption = options.find(
    (option) =>
      normalizeMultiSelectComparisonKey(option.label, locale) ===
      normalizeMultiSelectComparisonKey(normalizedCreateQuery, locale),
  );
  const canCreate = Boolean(
    create &&
      !exactOption &&
      create.isValid(normalizedCreateQuery) &&
      !isCreating,
  );

  function toggle(option: CreatableMultiSelectOption<Id>) {
    onChange(
      selectedIds.includes(option.id)
        ? selectedIds.filter((id) => id !== option.id)
        : [...selectedIds, option.id],
    );
    setError(null);
    setQuery("");
    setActiveIndex(0);
  }

  function selectExactDuplicate(option: CreatableMultiSelectOption<Id>) {
    if (!selectedIds.includes(option.id)) onChange([...selectedIds, option.id]);
    setError(create?.duplicateMessage(option.label) ?? null);
    setActiveIndex(Math.max(0, matches.findIndex(({ id }) => id === option.id)));
  }

  async function createFromQuery() {
    if (!create) return;
    if (exactOption) {
      selectExactDuplicate(exactOption);
      return;
    }
    if (!canCreate) return;
    setIsCreating(true);
    setError(null);
    const result = await create.onCreate(normalizedCreateQuery);
    setIsCreating(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onChange([...new Set([...selectedIds, result.option.id])]);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        Math.min(current + 1, Math.max(matches.length - 1, 0)),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (exactOption) {
      selectExactDuplicate(exactOption);
      return;
    }
    const activeOption = matches[activeIndex];
    if (activeOption) toggle(activeOption);
    else void createFromQuery();
  }

  return (
    <div ref={containerRef}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-slate-900"
          >
            {label}
          </label>
          {helpText && <p className="mt-1 text-sm text-slate-600">{helpText}</p>}
        </div>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"
          >
            {clearAllLabel}
          </button>
        )}
      </div>

      {selectedOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <span
              key={option.id}
              className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800"
            >
              <span className="truncate">{option.label}</span>
              {getSelectedOptionAnnotation?.(option)}
              <button
                type="button"
                onClick={() => toggle(option)}
                aria-label={getRemoveLabel?.(option) ?? `${option.label} entfernen`}
                className="min-h-8 min-w-8 rounded-full text-lg leading-none hover:bg-slate-100"
              >
                <span aria-hidden="true">×</span>
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        id={inputId}
        ref={triggerRef}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        value={query}
        maxLength={maxLength}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setError(null);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="mt-3 min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-200"
      />

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {matches.map((option, index) => {
            const selected = selectedIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => toggle(option)}
                className={`flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-slate-100" : "bg-white"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">{option.label}</span>
                  {getOptionDescription?.(option, query)}
                </span>
                <span aria-hidden="true">{selected ? "✓" : "+"}</span>
              </button>
            );
          })}

          {getSearchHint?.(query, matches)}

          {exactOption && create && (
            <div className="m-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p>{create.duplicateMessage(exactOption.label)}</p>
              {!selectedIds.includes(exactOption.id) && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectExactDuplicate(exactOption)}
                  className="mt-2 min-h-10 rounded-lg border border-amber-400 bg-white px-3 font-semibold"
                >
                  Vorhandenen Eintrag auswählen
                </button>
              )}
            </div>
          )}

          {canCreate && create && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void createFromQuery()}
              className="min-h-12 w-full rounded-lg border border-dashed border-slate-400 px-3 py-2 text-left text-sm font-semibold text-slate-900"
            >
              {create.label(normalizedCreateQuery)}
            </button>
          )}

          {matches.length === 0 && !canCreate && !exactOption && (
            <p className="px-3 py-4 text-sm text-slate-500">{emptyMessage}</p>
          )}
        </div>
      )}

      <div aria-live="polite">
        {isCreating && create && (
          <p role="status" className="mt-2 text-sm text-slate-600">{create.pendingLabel}</p>
        )}
        {error && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </div>
  );
}
