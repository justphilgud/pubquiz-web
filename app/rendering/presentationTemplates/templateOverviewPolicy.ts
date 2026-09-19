import type { ManagedPresentationTemplate } from "./presentationTemplate";
import { UNGEGOOGELT_NEON_COLORS } from "@/app/rendering/templateRegistry";

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
    if (!filters.status && template.status === "ARCHIVED") return false;
    if (filters.status === "CURRENT" && template.status === "ARCHIVED") return false;
    if (filters.status && !["ALL", "CURRENT"].includes(filters.status) && template.status !== filters.status) return false;
    if (filters.source && filters.source !== "ALL" && template.source !== filters.source) return false;
    if (!query) return true;
    return [template.name, template.id, template.description ?? "", ...template.tags]
      .join(" ")
      .toLocaleLowerCase("de")
      .includes(query);
  });
}

export function presentationTemplateCardBackground(
  template: Pick<ManagedPresentationTemplate, "config">,
) {
  if (template.config.design.stylePreset === "NEON") {
    const neon = UNGEGOOGELT_NEON_COLORS;
    return `radial-gradient(circle at 14% 8%, ${neon.blue}66 0, transparent 34%), radial-gradient(circle at 88% 18%, ${neon.pink}55 0, transparent 30%), radial-gradient(circle at 24% 100%, ${neon.green}40 0, transparent 34%), ${template.config.tokens.colors.background}`;
  }
  return `linear-gradient(135deg, ${template.config.tokens.colors.background}, ${template.config.tokens.colors.primary}55)`;
}

export function presentationTemplateCardAccent(
  template: Pick<ManagedPresentationTemplate, "config">,
) {
  if (template.config.design.stylePreset === "NEON") {
    const neon = UNGEGOOGELT_NEON_COLORS;
    return `linear-gradient(90deg, ${neon.blue}, ${neon.cyan}, ${neon.green}, ${neon.orange}, ${neon.coral}, ${neon.pink}, ${neon.violet})`;
  }
  return template.config.tokens.colors.accent;
}
