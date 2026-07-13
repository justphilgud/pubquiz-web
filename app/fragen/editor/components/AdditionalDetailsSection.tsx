import { useId, useState } from "react";
import type { QuestionCategory } from "../types";
import { CategorySection } from "./CategorySection";
import { NotesSection } from "./NotesSection";

type AdditionalDetailsSectionProps = {
  categories: QuestionCategory[];
  selectedCategoryIds: number[];
  sourceOrRemark: string;
  moderationNotes: string;
  validUntil: string | null;
  initiallyOpen?: boolean;
  onChangeCategories: (categoryIds: number[]) => void;
  onSourceOrRemarkChange: (sourceOrRemark: string) => void;
  onModerationNotesChange: (moderationNotes: string) => void;
  onValidUntilChange: (validUntil: string | null) => void;
};

function formatValidUntil(validUntil: string): string {
  const [year, month, day] = validUntil.split("-");

  return day && month && year ? `${day}.${month}.${year}` : validUntil;
}

export function AdditionalDetailsSection({
  categories,
  selectedCategoryIds,
  sourceOrRemark,
  moderationNotes,
  validUntil,
  initiallyOpen = false,
  onChangeCategories,
  onSourceOrRemarkChange,
  onModerationNotesChange,
  onValidUntilChange,
}: AdditionalDetailsSectionProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const contentId = useId();
  const validUntilId = useId();
  const summaries = [
    selectedCategoryIds.length > 0
      ? `${selectedCategoryIds.length} ${
          selectedCategoryIds.length === 1 ? "Kategorie" : "Kategorien"
        }`
      : null,
    sourceOrRemark.trim() ? "Quelle vorhanden" : null,
    moderationNotes.trim() ? "Moderationsnotiz vorhanden" : null,
    validUntil === ""
      ? "Ablaufdatum aktiviert"
      : validUntil
        ? `Gültig bis ${formatValidUntil(validUntil)}`
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
            Weitere Angaben
          </span>
          <span className="mt-1 block truncate text-sm text-slate-600">
            {summaries.length > 0
              ? summaries.join(" · ")
              : "Kategorien, interne Angaben und Ablaufdatum"}
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
          />

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
                Zeitlich begrenzte Frage
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Nutze diese Einstellung für Fragen, deren Antwort nur bis zu
                einem bestimmten Zeitpunkt aktuell ist, zum Beispiel „Vogel des
                Jahres 2026“.
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
                  Frage hat ein Ablaufdatum
                </span>
                <span className="mt-1 block text-sm text-slate-600">
                  Nach dem Ablauf bleibt die Frage erhalten, wird aber nicht mehr
                  automatisch für neue Quizze vorgeschlagen.
                </span>
              </span>
            </label>

            {validUntil !== null && (
              <div className="mt-4">
                <label
                  htmlFor={validUntilId}
                  className="text-sm font-medium text-slate-900"
                >
                  Aktuell nutzbar bis einschließlich
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
                  Ab dem folgenden Tag gilt die Frage als veraltet. Sie wird nicht
                  gelöscht und kann weiterhin gefunden, bearbeitet oder bewusst
                  verwendet werden.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
