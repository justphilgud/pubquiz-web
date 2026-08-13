"use client";

import {
  CreatableMultiSelect,
  normalizeMultiSelectComparisonKey,
} from "@/components/ui";
import { normalizeTemplateTags } from "./presentationTemplate";

type Props = {
  availableTags: readonly string[];
  value: readonly string[];
  onChange: (tags: string[]) => void;
};

export function normalizePresentationTemplateTag(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

export function PresentationTemplateTagSelector({
  availableTags,
  value,
  onChange,
}: Props) {
  const options = normalizeTemplateTags([...availableTags, ...value]).map(
    (tag) => ({ id: tag, label: tag }),
  );
  const selectedIds = normalizeTemplateTags(value).flatMap((selectedTag) => {
    const match = options.find(
      (option) =>
        normalizeMultiSelectComparisonKey(option.label) ===
        normalizeMultiSelectComparisonKey(selectedTag),
    );
    return match ? [match.id] : [];
  });

  return (
    <fieldset className="rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-bold">Tags</legend>
      <CreatableMultiSelect
        label="Tags auswählen oder anlegen"
        helpText="Mehrere passende Tags können ausgewählt werden."
        options={options}
        selectedIds={selectedIds}
        onChange={(tags) => onChange(normalizeTemplateTags(tags))}
        placeholder="Tags durchsuchen …"
        emptyMessage="Keine passenden Tags gefunden."
        clearAllLabel="Alle Tags entfernen"
        maxLength={40}
        create={{
          normalize: normalizePresentationTemplateTag,
          isValid: (tag) => tag.length > 0 && tag.length <= 40,
          label: (tag) => `Tag „${tag}“ anlegen`,
          duplicateMessage: (tag) => `Tag „${tag}“ existiert bereits.`,
          pendingLabel: "Tag wird angelegt …",
          onCreate: async (tag) => ({ ok: true, option: { id: tag, label: tag } }),
        }}
      />
    </fieldset>
  );
}
