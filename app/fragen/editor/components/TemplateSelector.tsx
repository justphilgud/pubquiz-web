import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import type { QuestionTemplate } from "../types";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";
import { normalizeEditorSearch } from "@/app/i18n/formatting";
import { formatMessage } from "@/app/i18n/formatMessage";

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
  const { locale, messages } = useQuestionEditorMessages();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = normalizeEditorSearch(locale, searchQuery);

    return templates.filter((template) =>
      normalizeEditorSearch(
        locale,
        `${template.name} ${template.description}`,
      ).includes(normalizedQuery),
    );
  }, [locale, searchQuery, templates]);

  function closePicker() {
    setIsPickerOpen(false);
    setSearchQuery("");
  }

  function selectTemplate(template: QuestionTemplate) {
    if (onSelectTemplate(template)) {
      closePicker();
    }
  }

  function selectStandardQuestion() {
    onClearSelection();
    closePicker();
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-3">
        {selectedTemplate ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-950">
                {formatMessage(messages.templateSelector.selected, { name: selectedTemplate.name })}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {selectedTemplate.description}
              </p>
              {selectedTemplate.mediaSlots.find((slot) => slot.required) && (
                <p className="mt-1 text-sm font-medium text-amber-700">
                  {formatMessage(messages.templateSelector.required, { label: selectedTemplate.mediaSlots.find((slot) => slot.required)!.label })}
                </p>
              )}
            </div>

            <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:flex-col sm:items-end sm:gap-1">
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 sm:flex-none"
              >
                {messages.templateSelector.change}
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                className="min-h-11 flex-1 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-100 sm:min-h-0 sm:flex-none sm:py-1 sm:text-xs"
              >
                {messages.templateSelector.clear}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="min-h-11 w-full rounded-xl border border-dashed border-slate-300 px-4 py-2 text-left text-sm font-medium text-slate-800 hover:border-slate-500"
          >
            {messages.templateSelector.select}
          </button>
        )}
      </section>

      <Modal
        open={isPickerOpen}
        title={messages.templateSelector.select}
        onClose={closePicker}
        footer={
          <button
            type="button"
            onClick={closePicker}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-800 sm:w-auto"
          >
            {messages.common.cancel}
          </button>
        }
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-900">
            {messages.templateSelector.searchLabel}
          </span>
          <SearchInput
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={messages.templateSelector.searchPlaceholder}
            className="mt-2 min-h-11 rounded-xl border-slate-300 px-4 py-3 focus:border-slate-950 focus:ring-slate-200"
          />
        </label>

        <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto">
          <button
            type="button"
            onClick={selectStandardQuestion}
            aria-pressed={selectedTemplateId === null}
            className={[
              "min-h-11 w-full rounded-xl border px-4 py-3 text-left transition",
              selectedTemplateId === null
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-300 bg-white text-slate-800 hover:border-slate-500",
            ].join(" ")}
          >
            <span className="block font-medium">Standardfrage</span>
            <span className={selectedTemplateId === null ? "mt-1 block text-sm text-slate-200" : "mt-1 block text-sm text-slate-600"}>Keine Spezialvorlage</span>
          </button>
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
            {messages.templateSelector.empty}
          </p>
        )}
      </Modal>
    </>
  );
}
