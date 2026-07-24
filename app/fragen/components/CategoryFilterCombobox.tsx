"use client";

import { useId, useMemo, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
import { rankCategoryMatches } from "../editor/categoryPolicy";

export type QuestionFilterCategory = {
  fragenkategorie_id: number;
  kategorie: string;
  status: "ACTIVE" | "PENDING" | "ARCHIVED";
};

export function CategoryFilterCombobox({
  categories,
  value,
  onChange,
}: {
  categories: QuestionFilterCategory[];
  value: number | null;
  onChange: (categoryId: number | null) => void;
}) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = categories.find(
    (category) => category.fragenkategorie_id === value,
  );
  const matches = useMemo(
    () =>
      rankCategoryMatches(
        categories.map((category) => ({
          ...category,
          name: category.kategorie,
        })),
        query,
        "de",
      ),
    [categories, query],
  );
  const { containerRef, triggerRef } =
    useDismissiblePopover<HTMLInputElement>({
      open,
      onClose: () => setOpen(false),
    });

  return (
    <div ref={containerRef}>
      <label htmlFor={`${listboxId}-input`} className="text-sm font-medium">
        Kategorie
      </label>
      <div className="relative mt-1">
        <input
          ref={triggerRef}
          id={`${listboxId}-input`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          value={open ? query : selected?.kategorie ?? query}
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
            if (event.key === "Escape") setOpen(false);
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) =>
                Math.min(current + 1, Math.max(matches.length - 1, 0)),
              );
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Enter" && matches[activeIndex]) {
              event.preventDefault();
              onChange(
                matches[activeIndex].category.fragenkategorie_id,
              );
              setOpen(false);
            }
          }}
          placeholder="Kategorie suchen"
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
        />
        {open && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(null);
                setQuery("");
                setOpen(false);
              }}
              className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
            >
              Alle Kategorien
            </button>
            {matches.map(({ category }, index) => (
              <button
                key={category.fragenkategorie_id}
                type="button"
                role="option"
                aria-selected={value === category.fragenkategorie_id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onChange(category.fragenkategorie_id);
                  setQuery("");
                  setOpen(false);
                }}
                className={[
                  "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100",
                  activeIndex === index ? "bg-slate-100" : "",
                ].join(" ")}
              >
                <span className="truncate">{category.kategorie}</span>
                {category.status === "ARCHIVED" && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">
                    Archiviert
                  </span>
                )}
              </button>
            ))}
            {matches.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-500">
                Keine passende Kategorie.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
