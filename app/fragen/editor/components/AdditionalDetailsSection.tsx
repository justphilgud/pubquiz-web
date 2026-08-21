import { useId, useState } from "react";
import type { QuestionCategory } from "../types";
import { CategorySection } from "./CategorySection";
import { NotesSection } from "./NotesSection";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { formatEditorDate, formatEditorNumber } from "@/app/i18n/formatting";
import { formatMessage } from "@/app/i18n/formatMessage";
import { QuestionLifecycleSection } from "./QuestionLifecycleSection";
import { validUntilToOutdatedFrom } from "../questionLifecycle";

type AdditionalDetailsSectionProps = {
  categories: QuestionCategory[];
  selectedCategoryIds: number[];
  sourceOrRemark: string;
  moderationNotes: string;
  categoryRequest: string;
  validUntil: string | null;
  reviewFrom: string | null;
  initiallyOpen?: boolean;
  onChangeCategories: (categoryIds: number[]) => void;
  onSourceOrRemarkChange: (sourceOrRemark: string) => void;
  onModerationNotesChange: (moderationNotes: string) => void;
  onCategoryRequestChange: (categoryRequest: string) => void;
  onValidUntilChange: (validUntil: string | null) => void;
  onReviewFromChange: (reviewFrom: string | null) => void;
  canManageCategories: boolean;
};

export function AdditionalDetailsSection({
  categories,
  selectedCategoryIds,
  sourceOrRemark,
  moderationNotes,
  categoryRequest,
  validUntil,
  reviewFrom,
  initiallyOpen = false,
  onChangeCategories,
  onSourceOrRemarkChange,
  onModerationNotesChange,
  onCategoryRequestChange,
  onValidUntilChange,
  onReviewFromChange,
  canManageCategories,
}: AdditionalDetailsSectionProps) {
  const { locale, messages } = useQuestionEditorMessages();
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const contentId = useId();
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
        ? formatMessage(messages.details.outdatedFrom, {
            date: formatEditorDate(locale, validUntilToOutdatedFrom(validUntil) ?? validUntil),
          })
        : null,
    reviewFrom === ""
      ? messages.details.lifecycleReview
      : reviewFrom
        ? formatMessage(messages.details.reviewFrom, {
            date: formatEditorDate(locale, reviewFrom),
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

          {categoryRequest.trim() && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
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
          )}

          <section className="rounded-2xl border border-slate-200 p-4">
            <NotesSection
              sourceOrRemark={sourceOrRemark}
              moderationNotes={moderationNotes}
              onSourceOrRemarkChange={onSourceOrRemarkChange}
              onModerationNotesChange={onModerationNotesChange}
            />
          </section>

          <QuestionLifecycleSection
            validUntil={validUntil}
            reviewFrom={reviewFrom}
            onChange={(value) => {
              onValidUntilChange(value.validUntil);
              onReviewFromChange(value.reviewFrom);
            }}
          />
        </div>
      )}
    </section>
  );
}
