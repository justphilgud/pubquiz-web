"use client";

import { useId, useMemo, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
import type { QuestionCategory } from "../types";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { formatMessage } from "@/app/i18n/formatMessage";
import {
  isValidCategoryName,
  normalizeCategoryName,
  rankCategoryMatches,
} from "../categoryPolicy";
import {
  createOrSuggestCategory,
  type CategoryActionErrorCode,
} from "../categoryActions";

type CategorySectionProps = {
  categories: QuestionCategory[];
  selectedCategoryIds: number[];
  onChangeCategories: (categoryIds: number[]) => void;
  canManageCategories: boolean;
};

function statusBadgeClass(status: QuestionCategory["status"]) {
  if (status === "PENDING") return "bg-amber-100 text-amber-900";
  if (status === "ARCHIVED") return "bg-slate-200 text-slate-700";
  return "bg-emerald-100 text-emerald-800";
}

export function CategorySection({
  categories,
  selectedCategoryIds,
  onChangeCategories,
  canManageCategories,
}: CategorySectionProps) {
  const { locale, messages } = useQuestionEditorMessages();
  const listboxId = useId();
  const [availableCategories, setAvailableCategories] = useState(categories);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [errorCode, setErrorCode] =
    useState<CategoryActionErrorCode | null>(null);

  const selectedCategories = useMemo(
    () =>
      availableCategories.filter((category) =>
        selectedCategoryIds.includes(category.id),
      ),
    [availableCategories, selectedCategoryIds],
  );
  const selectableCategories = useMemo(
    () =>
      availableCategories.filter(
        (category) =>
          category.status === "ACTIVE" ||
          selectedCategoryIds.includes(category.id),
      ),
    [availableCategories, selectedCategoryIds],
  );
  const matches = useMemo(
    () => rankCategoryMatches(selectableCategories, query, locale),
    [locale, query, selectableCategories],
  );
  const normalizedQuery = normalizeCategoryName(query);
  const hasExactMatch = matches.some(({ match }) => match === "EXACT");
  const canCreate =
    isValidCategoryName(normalizedQuery) && !hasExactMatch;
  const similarMatches = matches.filter(({ match }) => match === "SIMILAR");
  const { containerRef, triggerRef } =
    useDismissiblePopover<HTMLInputElement>({
      open: isOpen,
      onClose: () => setIsOpen(false),
    });

  function toggleCategory(categoryId: number) {
    onChangeCategories(
      selectedCategoryIds.includes(categoryId)
        ? selectedCategoryIds.filter((id) => id !== categoryId)
        : [...selectedCategoryIds, categoryId],
    );
    setQuery("");
    setActiveIndex(0);
  }

  async function createFromQuery() {
    if (!canCreate || isCreating) return;
    setIsCreating(true);
    setErrorCode(null);
    const result = await createOrSuggestCategory(normalizedQuery);
    setIsCreating(false);
    if (!result.ok) {
      setErrorCode(result.code);
      return;
    }
    setAvailableCategories((current) =>
      [...current, result.category].sort((left, right) =>
        left.name.localeCompare(right.name, locale),
      ),
    );
    onChangeCategories([
      ...new Set([...selectedCategoryIds, result.category.id]),
    ]);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(0);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
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
    if (event.key === "Enter") {
      event.preventDefault();
      const activeMatch = matches[activeIndex];
      if (activeMatch) {
        toggleCategory(activeMatch.category.id);
      } else if (canCreate) {
        void createFromQuery();
      }
    }
  }

  return (
    <section
      ref={containerRef}
      className="rounded-2xl border border-slate-200 bg-white p-4"
    >
      <h2 className="font-semibold text-slate-950">
        {messages.categories.title}
      </h2>

      {selectedCategories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedCategories.map((category) => (
            <span
              key={category.id}
              className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800"
            >
              <span className="truncate">{category.name}</span>
              {category.status !== "ACTIVE" && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(category.status)}`}
                >
                  {category.status === "PENDING"
                    ? messages.categories.pending
                    : messages.categories.archived}
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                aria-label={formatMessage(messages.categories.remove, {
                  name: category.name,
                })}
                className="min-h-8 min-w-8 rounded-full text-lg leading-none hover:bg-slate-100"
              >
                <span aria-hidden="true">×</span>
              </button>
            </span>
          ))}
        </div>
      )}

      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-900">
          {messages.categories.searchLabel}
        </span>
        <input
          ref={triggerRef}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          value={query}
          maxLength={100}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setErrorCode(null);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={messages.categories.searchPlaceholder}
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </label>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {matches.map(({ category, match }, index) => {
            const selected = selectedCategoryIds.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => toggleCategory(category.id)}
                className={[
                  "flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm",
                  index === activeIndex ? "bg-slate-100" : "bg-white",
                ].join(" ")}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">
                    {category.name}
                  </span>
                  {match === "SIMILAR" && (
                    <span className="text-xs text-slate-500">
                      {messages.categories.possibleMatch}
                    </span>
                  )}
                </span>
                <span aria-hidden="true">{selected ? "✓" : "+"}</span>
              </button>
            );
          })}

          {similarMatches.length > 0 && canCreate && (
            <p className="px-3 py-2 text-xs font-medium text-amber-800">
              {messages.categories.similarWarning}
            </p>
          )}

          {canCreate && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void createFromQuery()}
              disabled={isCreating}
              className="min-h-12 w-full rounded-lg border border-dashed border-slate-400 px-3 py-2 text-left text-sm font-semibold text-slate-900 disabled:opacity-60"
            >
              {formatMessage(
                canManageCategories
                  ? messages.categories.createFromQuery
                  : messages.categories.suggestFromQuery,
                { name: normalizedQuery },
              )}
            </button>
          )}

          {matches.length === 0 && !canCreate && (
            <p className="px-3 py-4 text-sm text-slate-500">
              {query.trim()
                ? messages.categories.notFound
                : messages.categories.none}
            </p>
          )}
        </div>
      )}

      <div aria-live="polite">
        {isCreating && (
          <p role="status" className="mt-2 text-sm text-slate-600">
            {canManageCategories
              ? messages.categories.creating
              : messages.categories.suggesting}
          </p>
        )}
        {errorCode && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            {messages.categories.errors[errorCode]}
          </p>
        )}
      </div>
    </section>
  );
}
