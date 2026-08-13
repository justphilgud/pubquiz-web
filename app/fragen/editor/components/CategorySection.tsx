"use client";

import { useState } from "react";

import {
  CreatableMultiSelect,
  type CreatableMultiSelectOption,
} from "@/components/ui";
import { formatMessage } from "@/app/i18n/formatMessage";
import type { QuestionCategory } from "../types";
import {
  isValidCategoryName,
  normalizeCategoryName,
  rankCategoryMatches,
} from "../categoryPolicy";
import { createOrSuggestCategory } from "../categoryActions";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

type CategorySectionProps = {
  categories: QuestionCategory[];
  selectedCategoryIds: number[];
  onChangeCategories: (categoryIds: number[]) => void;
  canManageCategories: boolean;
};

export function CategorySection({
  categories,
  selectedCategoryIds,
  onChangeCategories,
  canManageCategories,
}: CategorySectionProps) {
  const { locale, messages } = useQuestionEditorMessages();
  const [availableCategories, setAvailableCategories] = useState(categories);
  const selectableCategories = availableCategories.filter(
    (category) =>
      category.status === "ACTIVE" || selectedCategoryIds.includes(category.id),
  );
  const options: CreatableMultiSelectOption<number>[] = selectableCategories.map(
    (category) => ({ id: category.id, label: category.name }),
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-950">{messages.categories.title}</h2>
      <CreatableMultiSelect
        label={messages.categories.searchLabel}
        options={options}
        selectedIds={selectedCategoryIds}
        onChange={onChangeCategories}
        placeholder={messages.categories.searchPlaceholder}
        emptyMessage={messages.categories.notFound}
        clearAllLabel={messages.categories.clearAll}
        locale={locale}
        getRemoveLabel={(option) =>
          formatMessage(messages.categories.remove, { name: option.label })
        }
        getSelectedOptionAnnotation={(option) => {
          const category = selectableCategories.find(({ id }) => id === option.id);
          if (!category || category.status === "ACTIVE") return null;
          return (
            <span
              className={
                category.status === "PENDING"
                  ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                  : "rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700"
              }
            >
              {category.status === "PENDING"
                ? messages.categories.pending
                : messages.categories.archived}
            </span>
          );
        }}
        filterOptions={(entries, query) => {
          const byId = new Map(entries.map((entry) => [entry.id, entry]));
          return rankCategoryMatches(selectableCategories, query, locale)
            .map(({ category }) => byId.get(category.id))
            .filter((entry): entry is CreatableMultiSelectOption<number> => Boolean(entry));
        }}
        getOptionDescription={(option, query) => {
          const category = selectableCategories.find(({ id }) => id === option.id);
          const ranked = rankCategoryMatches(
            category ? [category] : [],
            query,
            locale,
          )[0];
          if (ranked?.match === "SIMILAR") {
            return <span className="block text-xs text-slate-500">{messages.categories.possibleMatch}</span>;
          }
          if (category?.status === "PENDING") {
            return <span className="block text-xs text-amber-700">{messages.categories.pending}</span>;
          }
          if (category?.status === "ARCHIVED") {
            return <span className="block text-xs text-slate-500">{messages.categories.archived}</span>;
          }
          return null;
        }}
        getSearchHint={(query) => {
          const hasSimilar = rankCategoryMatches(
            selectableCategories,
            query,
            locale,
          ).some(({ match }) => match === "SIMILAR");
          return hasSimilar && isValidCategoryName(query) ? (
            <p className="px-3 py-2 text-xs font-medium text-amber-800">{messages.categories.similarWarning}</p>
          ) : null;
        }}
        create={{
          normalize: normalizeCategoryName,
          isValid: isValidCategoryName,
          label: (name) => formatMessage(
            canManageCategories
              ? messages.categories.createFromQuery
              : messages.categories.suggestFromQuery,
            { name },
          ),
          duplicateMessage: (name) =>
            formatMessage(messages.categories.duplicate, { name }),
          pendingLabel: canManageCategories
            ? messages.categories.creating
            : messages.categories.suggesting,
          onCreate: async (name) => {
            const result = await createOrSuggestCategory(name);
            if (!result.ok) {
              return { ok: false, message: messages.categories.errors[result.code] };
            }
            setAvailableCategories((current) =>
              [...current, result.category].sort((left, right) =>
                left.name.localeCompare(right.name, locale),
              ),
            );
            return {
              ok: true,
              option: { id: result.category.id, label: result.category.name },
            };
          },
        }}
      />
    </section>
  );
}
