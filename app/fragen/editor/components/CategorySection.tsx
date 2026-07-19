import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import type { QuestionCategory } from "../types";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { normalizeEditorSearch } from "@/app/i18n/formatting";
import { formatMessage } from "@/app/i18n/formatMessage";
import {
  CategoryCreateControl,
  CategoryRowActions,
} from "./CategoryAdminControls";

type CategorySectionProps = {
  categories: QuestionCategory[];
  selectedCategoryIds: number[];
  onChangeCategories: (categoryIds: number[]) => void;
  canManageCategories: boolean;
};

function haveSameCategoryIds(left: number[], right: number[]): boolean {
  return (
    left.length === right.length &&
    left.every((categoryId) => right.includes(categoryId))
  );
}

export function CategorySection({
  categories,
  selectedCategoryIds,
  onChangeCategories,
  canManageCategories,
}: CategorySectionProps) {
  const { locale, messages } = useQuestionEditorMessages();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isDiscardConfirmationOpen, setIsDiscardConfirmationOpen] =
    useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [initialCategoryIds, setInitialCategoryIds] = useState<number[]>([]);
  const [pendingCategoryIds, setPendingCategoryIds] = useState<number[]>([]);
  const [availableCategories, setAvailableCategories] = useState(categories);

  const selectedCategories = useMemo(
    () =>
      availableCategories.filter((category) =>
        selectedCategoryIds.includes(category.id),
      ),
    [availableCategories, selectedCategoryIds],
  );

  const filteredCategories = useMemo(() => {
    const normalizedQuery = normalizeEditorSearch(locale, searchQuery);

    return availableCategories.filter((category) =>
      normalizeEditorSearch(locale, category.name).includes(normalizedQuery),
    );
  }, [availableCategories, locale, searchQuery]);

  function sortCategories(nextCategories: QuestionCategory[]) {
    return [...nextCategories].sort((left, right) =>
      left.name.localeCompare(right.name, locale),
    );
  }

  function addAvailableCategory(category: QuestionCategory) {
    setAvailableCategories((current) => sortCategories([...current, category]));
    setPendingCategoryIds((current) => [...new Set([...current, category.id])]);
  }

  function renameAvailableCategory(category: QuestionCategory) {
    setAvailableCategories((current) =>
      sortCategories(
        current.map((candidate) =>
          candidate.id === category.id ? category : candidate,
        ),
      ),
    );
  }

  function removeAvailableCategory(categoryId: number) {
    setAvailableCategories((current) =>
      current.filter((category) => category.id !== categoryId),
    );
    setPendingCategoryIds((current) => current.filter((id) => id !== categoryId));
    setInitialCategoryIds((current) => current.filter((id) => id !== categoryId));
    onChangeCategories(selectedCategoryIds.filter((id) => id !== categoryId));
  }

  const hasPendingChanges = !haveSameCategoryIds(
    initialCategoryIds,
    pendingCategoryIds,
  );

  function openPicker() {
    const currentCategoryIds = [...selectedCategoryIds];

    setInitialCategoryIds(currentCategoryIds);
    setPendingCategoryIds(currentCategoryIds);
    setSearchQuery("");
    setIsPickerOpen(true);
  }

  function resetPickerState() {
    setIsPickerOpen(false);
    setIsDiscardConfirmationOpen(false);
    setSearchQuery("");
    setInitialCategoryIds([]);
    setPendingCategoryIds([]);
  }

  function requestCancelPicker() {
    if (!hasPendingChanges) {
      resetPickerState();
      return;
    }

    setIsPickerOpen(false);
    setIsDiscardConfirmationOpen(true);
  }

  function continueSelecting() {
    setIsDiscardConfirmationOpen(false);
    setIsPickerOpen(true);
  }

  function togglePendingCategory(categoryId: number) {
    setPendingCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  function applyCategories() {
    onChangeCategories([...pendingCategoryIds]);
    resetPickerState();
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">{messages.categories.title}</h2>

        {selectedCategories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() =>
                  onChangeCategories(
                    selectedCategoryIds.filter((id) => id !== category.id),
                  )
                }
                aria-label={formatMessage(messages.categories.remove, { name: category.name })}
                className="min-h-10 rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-200"
              >
                {category.name} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={openPicker}
          className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:border-slate-500"
        >
          {messages.categories.select}
        </button>
      </section>

      <Modal
        open={isPickerOpen}
        title={messages.categories.select}
        onClose={requestCancelPicker}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={requestCancelPicker}
              className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-800"
            >
              {messages.common.cancel}
            </button>
            <button
              type="button"
              onClick={applyCategories}
              className="min-h-11 rounded-xl bg-slate-950 px-4 py-2 font-medium text-white"
            >
              {formatMessage(messages.categories.done, { count: pendingCategoryIds.length })}
            </button>
          </div>
        }
      >
        <div className="flex max-h-[calc(100dvh-12rem)] min-h-0 flex-col">
          <label className="block shrink-0">
            <span className="text-sm font-medium text-slate-900">
              {messages.categories.searchLabel}
            </span>
            <SearchInput
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={messages.categories.searchPlaceholder}
              className="mt-2 min-h-11 rounded-xl border-slate-300 px-4 py-3 focus:border-slate-950 focus:ring-slate-200"
            />
          </label>

          {canManageCategories && (
            <CategoryCreateControl onCreated={addAvailableCategory} />
          )}

          <div className="mt-4 min-h-0 space-y-2 overflow-y-auto pr-1">
            {filteredCategories.map((category) => {
              const isSelected = pendingCategoryIds.includes(category.id);

              return (
                <div
                  key={category.id}
                  className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start"
                >
                  <button
                    type="button"
                    onClick={() => togglePendingCategory(category.id)}
                    aria-pressed={isSelected}
                    className={[
                      "flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition",
                      isSelected
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-300 bg-white text-slate-800 hover:border-slate-500",
                    ].join(" ")}
                  >
                    <span>{category.name}</span>
                    <span aria-hidden="true">{isSelected ? "✓" : "+"}</span>
                  </button>
                  {canManageCategories && (
                    <CategoryRowActions
                      category={category}
                      onRenamed={renameAvailableCategory}
                      onDeleted={removeAvailableCategory}
                    />
                  )}
                </div>
              );
            })}

            {filteredCategories.length === 0 && (
              <p className="py-3 text-sm text-slate-500">
                {availableCategories.length === 0
                  ? messages.categories.none
                  : messages.categories.notFound}
              </p>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={isDiscardConfirmationOpen}
        title={messages.categories.discardTitle}
        cancelLabel={messages.categories.continue}
        confirmLabel={messages.categories.discard}
        danger
        onClose={continueSelecting}
        onConfirm={resetPickerState}
      >
        <p>
          {messages.categories.discardDescription}
        </p>
      </ConfirmDialog>
    </>
  );
}
