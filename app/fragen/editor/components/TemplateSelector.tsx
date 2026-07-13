import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import type { QuestionTemplate } from "../types";

type TemplateSelectorProps = {
  templates: QuestionTemplate[];
  selectedTemplateId: string | null;
  selectedTemplate: QuestionTemplate | null;
  onSelectTemplate: (template: QuestionTemplate) => boolean;
  onClearSelection: () => void;
};

export function TemplateSelector({
  templates,
  selectedTemplateId,
  selectedTemplate,
  onSelectTemplate,
  onClearSelection,
}: TemplateSelectorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("de-DE");

    return templates.filter((template) =>
      `${template.name} ${template.description}`
        .toLocaleLowerCase("de-DE")
        .includes(normalizedQuery),
    );
  }, [searchQuery, templates]);

  function closePicker() {
    setIsPickerOpen(false);
    setSearchQuery("");
  }

  function selectTemplate(template: QuestionTemplate) {
    if (onSelectTemplate(template)) {
      closePicker();
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-3">
        {selectedTemplate ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-950">
                Spezialfrage: {selectedTemplate.name}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {selectedTemplate.description}
              </p>
              {selectedTemplate.requiresQuestionMedia && (
                <p className="mt-1 text-sm font-medium text-amber-700">
                  Für diese Spezialfrage wird ein Bild benötigt.
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
              >
                Ändern
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Auswahl lösen
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="min-h-11 w-full rounded-xl border border-dashed border-slate-300 px-4 py-2 text-left text-sm font-medium text-slate-800 hover:border-slate-500"
          >
            Spezialfrage auswählen
          </button>
        )}
      </section>

      <Modal
        open={isPickerOpen}
        title="Spezialfrage auswählen"
        onClose={closePicker}
        footer={
          <button
            type="button"
            onClick={closePicker}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-800 sm:w-auto"
          >
            Abbrechen
          </button>
        }
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-900">
            Spezialfragen durchsuchen
          </span>
          <SearchInput
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Spezialfrage suchen"
            className="mt-2 min-h-11 rounded-xl border-slate-300 px-4 py-3 focus:border-slate-950 focus:ring-slate-200"
          />
        </label>

        <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto">
          {filteredTemplates.map((template) => {
            const isSelected = template.id === selectedTemplateId;

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                aria-pressed={isSelected}
                className={[
                  "min-h-11 w-full rounded-xl border px-4 py-3 text-left transition",
                  isSelected
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:border-slate-500",
                ].join(" ")}
              >
                <span className="block font-medium">{template.name}</span>
                <span
                  className={[
                    "mt-1 block text-sm",
                    isSelected ? "text-slate-200" : "text-slate-600",
                  ].join(" ")}
                >
                  {template.description}
                </span>
              </button>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            Keine Spezialfrage gefunden.
          </p>
        )}
      </Modal>
    </>
  );
}
