import type { ManagedPresentationTemplate } from "./presentationTemplate";

export type TemplateOverviewFilters = {
  query?: string;
  status?: string;
  source?: string;
};

export function filterPresentationTemplates(
  templates: readonly ManagedPresentationTemplate[],
  filters: TemplateOverviewFilters,
) {
  const query = filters.query?.trim().toLocaleLowerCase("de") ?? "";
  return templates.filter((template) => {
    if (filters.status && filters.status !== "ALL" && template.status !== filters.status) return false;
    if (filters.source && filters.source !== "ALL" && template.source !== filters.source) return false;
    if (!query) return true;
    return [template.name, template.id, template.description ?? "", ...template.tags]
      .join(" ")
      .toLocaleLowerCase("de")
      .includes(query);
  });
}
