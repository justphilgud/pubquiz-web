import { useId, useState } from "react";
import type { QuestionCategory } from "../types";
import { CategorySection } from "./CategorySection";
import { NotesSection } from "./NotesSection";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { formatEditorDate, formatEditorNumber } from "@/app/i18n/formatting";
import { formatMessage } from "@/app/i18n/formatMessage";

type AdditionalDetailsSectionProps = {
  categories: QuestionCategory[];
  selectedCategoryIds: number[];
  sourceOrRemark: string;
  moderationNotes: string;
  categoryRequest: string;
  validUntil: string | null;
  initiallyOpen?: boolean;
  onChangeCategories: (categoryIds: number[]) => void;
  onSourceOrRemarkChange: (sourceOrRemark: string) => void;
  onModerationNotesChange: (moderationNotes: string) => void;
  onCategoryRequestChange: (categoryRequest: string) => void;
  onValidUntilChange: (validUntil: string | null) => void;
  canManageCategories: boolean;
};

export function AdditionalDetailsSection({
  categories,
  selectedCategoryIds,
  sourceOrRemark,
  moderationNotes,
  categoryRequest,
  validUntil,
  initiallyOpen = false,
  onChangeCategories,
  onSourceOrRemarkChange,
  onModerationNotesChange,
  onCategoryRequestChange,
  onValidUntilChange,
  canManageCategories,
}: AdditionalDetailsSectionProps) {
  const { locale, messages } = useQuestionEditorMessages();
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const contentId = useId();
  const validUntilId = useId();
  const summaries = [
    selectedCategoryIds.length > 0
      ? formatMessage(
          selectedCategoryIds.length === 1
            ? messages.details.category
            : messages.details.categories,
          { count: formatEditorNumber(locale, selectedCategoryIds.length) },
        )
      : null,
    sourceOrRemark.trim() ? messages.details.sourcePresent : null,
    moderationNotes.trim() ? messages.details.moderationPresent : null,
    categoryRequest.trim() ? messages.details.categoryRequestPresent : null,
    validUntil === ""
      ? messages.details.expiryEnabled
      : validUntil
        ? formatMessage(messages.details.validUntil, {
            date: formatEditorDate(locale, validUntil),
          })
        : null,
  ].filter((summary): summary is string => summary !== null);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex min-h-14 w-full items-center justify-between gap-4 p-4 text-left"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-slate-950">
            {messages.details.title}
          </span>
          <span className="mt-1 block truncate text-sm text-slate-600">
            {summaries.length > 0
              ? summaries.join(" · ")
              : messages.details.emptySummary}
          </span>
        </span>
        <span className="shrink-0 text-xl text-slate-500" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen && (
        <div id={contentId} className="space-y-4 border-t border-slate-200 p-4">
          <CategorySection
            categories={categories}
            selectedCategoryIds={selectedCategoryIds}
            onChangeCategories={onChangeCategories}
            canManageCategories={canManageCategories}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="block">
              <span className="font-medium text-slate-950">
                {messages.details.categoryRequest}
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                {messages.details.categoryRequestHelp}
              </span>
              <textarea
                value={categoryRequest}
                maxLength={500}
                onChange={(event) => onCategoryRequestChange(event.target.value)}
                placeholder={messages.details.categoryRequestPlaceholder}
                className="mt-3 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <NotesSection
              sourceOrRemark={sourceOrRemark}
              moderationNotes={moderationNotes}
              onSourceOrRemarkChange={onSourceOrRemarkChange}
              onModerationNotesChange={onModerationNotesChange}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <div>
              <h3 className="font-medium text-slate-950">
                {messages.details.expiryTitle}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {messages.details.expiryDescription}
              </p>
            </div>

            <label className="mt-4 flex items-start gap-3">
              <input
                type="checkbox"
                checked={validUntil !== null}
                onChange={(event) =>
                  onValidUntilChange(event.target.checked ? "" : null)
                }
                className="mt-0.5 h-5 w-5"
              />
              <span>
                <span className="block font-medium text-slate-900">
                  {messages.details.hasExpiry}
                </span>
                <span className="mt-1 block text-sm text-slate-600">
                  {messages.details.hasExpiryHelp}
                </span>
              </span>
            </label>

            {validUntil !== null && (
              <div className="mt-4">
                <label
                  htmlFor={validUntilId}
                  className="text-sm font-medium text-slate-900"
                >
                  {messages.details.usableUntil}
                </label>
                <input
                  id={validUntilId}
                  data-editor-valid-until
                  type="date"
                  value={validUntil}
                  onChange={(event) => onValidUntilChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                />
                <p className="mt-2 text-sm text-slate-600">
                  {messages.details.expiryAfterHelp}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
