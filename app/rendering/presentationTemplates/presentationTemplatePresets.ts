import { presentationDesigns, templateRegistry, type PresentationDesignStyle, type PresentationTemplate } from "@/app/rendering/templateRegistry";
import type { PresentationTemplateConfig } from "./presentationTemplate";

export const presentationStylePresets = [
  { id: "NEON", name: "ungegoogelt Neon", description: "Leuchtende Eventoptik mit starken Kontrasten und markanten Statusanzeigen.", useCase: "Pubquiz, Bühne und Live-Event", swatches: ["#080014", "#38e8ff", "#ff3bd4"] },
  { id: "CORPORATE", name: "Corporate", description: "Klare Flächen, sachliche Typografie und ein ruhiger Markenbereich.", useCase: "Firmenquiz, Workshop und Kundenevent", swatches: ["#f1f5f9", "#1d4ed8", "#334155"] },
  { id: "BIRTHDAY", name: "Geburtstag", description: "Persönliche Bilder, Albumrahmen und eine warme festliche Anmutung.", useCase: "Geburtstag, Jubiläum und Familienfest", swatches: ["#fff7ed", "#be185d", "#f59e0b"] },
] as const satisfies readonly { id: PresentationDesignStyle; name: string; description: string; useCase: string; swatches: readonly string[] }[];

const templateIdByStyle: Record<PresentationDesignStyle, string> = {
  NEON: "ungegoogelt-default",
  CORPORATE: "corporate-reference",
  BIRTHDAY: "birthday-reference",
};

export function createPresentationStylePreset(style: PresentationDesignStyle): PresentationTemplateConfig {
  const presentation = templateRegistry.presentation.find((template) => template.id === templateIdByStyle[style]) as PresentationTemplate | undefined;
  const answerForm = templateRegistry.answerForm.find((template) => template.id === templateIdByStyle[style]);
  if (!presentation || !answerForm) throw new Error(`Missing system preset: ${style}`);
  return {
    version: 1,
    tokens: structuredClone(presentation.tokens),
    surfaces: { presentation: presentation.variant, moderation: presentation.moderationVariant ?? "BRANDED", answerForm: answerForm.variant },
    design: structuredClone(presentationDesigns[style]),
  };
}

export function applyPresentationStylePreset(current: PresentationTemplateConfig, style: PresentationDesignStyle) {
  const preset = createPresentationStylePreset(style);
  preset.tokens.assets = structuredClone(current.tokens.assets);
  preset.design.imagery = structuredClone(current.design.imagery);
  preset.design.occasion = structuredClone(current.design.occasion);
  preset.design.storybook = style === "BIRTHDAY"
    ? structuredClone(current.design.storybook ?? presentationDesigns.BIRTHDAY.storybook)
    : null;
  preset.design.stylePreset = style;
  preset.design.composition = structuredClone(presentationDesigns[style].composition);
  return preset;
}

export const compatibleLayoutPresets: Record<PresentationDesignStyle, readonly PresentationTemplateConfig["design"]["composition"]["layoutPreset"][]> = {
  NEON: ["CLASSIC", "IMAGE_FOCUS", "SPLIT"],
  CORPORATE: ["CLASSIC", "SPLIT", "MAGAZINE"],
  BIRTHDAY: ["IMAGE_FOCUS", "MAGAZINE", "COLLAGE"],
};
