"use client";

import { useId, useMemo, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";

type TemplateOption = { id: string; name: string };

export function filterTemplateOptions(
  templates: readonly TemplateOption[],
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("de");
  return normalizedQuery
    ? templates.filter((template) =>
        template.name.toLocaleLowerCase("de").includes(normalizedQuery),
      )
    : [...templates];
}

export function toggleTemplateFilter(
  selectedIds: readonly string[],
  templateId: string,
) {
  return selectedIds.includes(templateId)
    ? selectedIds.filter((current) => current !== templateId)
    : [...selectedIds, templateId];
}

export function getTemplateFilterDisplayValue(
  templates: readonly TemplateOption[],
  selectedIds: readonly string[],
) {
  const selectedTemplates = templates.filter((template) =>
    selectedIds.includes(template.id),
  );
  if (selectedTemplates.length === 1) return selectedTemplates[0].name;
  return selectedTemplates.length > 1
    ? `${selectedTemplates.length} Templates ausgewählt`
    : "";
}

export function TemplateFilterCombobox({
  templates,
  value,
  onChange,
}: {
  templates: TemplateOption[];
  value: string[];
  onChange: (templateIds: string[]) => void;
}) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = useMemo(
    () => filterTemplateOptions(templates, query),
    [query, templates],
  );
  const closedValue = getTemplateFilterDisplayValue(templates, value);
  const { containerRef, triggerRef } =
    useDismissiblePopover<HTMLInputElement>({
    open,
    onClose: () => setOpen(false),
  });

  function toggle(templateId: string) {
    onChange(toggleTemplateFilter(value, templateId));
  }

  return (
    <div ref={containerRef}>
      <label htmlFor={`${listboxId}-input`} className="text-sm font-medium">
        Fragentemplate
      </label>
      <div className="relative mt-1">
        <input
          ref={triggerRef}
          id={`${listboxId}-input`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && matches[activeIndex]
              ? `${listboxId}-${matches[activeIndex].id}`
              : undefined
          }
          value={open ? query : closedValue}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) =>
                Math.min(current + 1, Math.max(matches.length - 1, 0)),
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter" && matches[activeIndex]) {
              event.preventDefault();
              toggle(matches[activeIndex].id);
            }
          }}
          placeholder={
            value.length > 0
              ? `${value.length} ausgewählt`
              : "Template suchen oder auswählen"
          }
          className={[
            "min-h-11 w-full rounded-xl border px-3 py-2 pr-10",
            value.length > 0
              ? "border-slate-700 bg-slate-50 font-medium"
              : "border-slate-300 bg-white",
          ].join(" ")}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
        >
          {open ? "▴" : "▾"}
        </span>
        {open && (
          <div
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          >
            {matches.map((template, index) => {
              const selected = value.includes(template.id);
              return (
                <button
                  id={`${listboxId}-${template.id}`}
                  key={template.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => toggle(template.id)}
                  className={[
                    "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm",
                    activeIndex === index ? "bg-slate-100" : "hover:bg-slate-100",
                  ].join(" ")}
                >
                  <span>{template.name}</span>
                  <span aria-hidden="true">{selected ? "✓" : "+"}</span>
                </button>
              );
            })}
            {matches.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-500">
                Kein passendes Template.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
