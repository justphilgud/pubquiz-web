import { presentationDesigns, templateRegistry, type PresentationDesignStyle, type PresentationTemplate } from "@/app/rendering/templateRegistry";
import type { PresentationTemplateConfig } from "./presentationTemplate";

export const presentationStylePresets = [
  { id: "NEON", name: "ungegoogelt Neon", description: "Mehrfarbige Neonbühne mit der offiziellen ungegoogelt-Logofarbwelt.", useCase: "Pubquiz, Bühne und Live-Event", swatches: ["#008BFF", "#00FF57", "#FF009C"] },
  { id: "BIRTHDAY", name: "Storybook", description: "Eine ruhige, persönliche Fotobuch-Welt mit redaktioneller Typografie und kuratierten Erinnerungen.", useCase: "Geburtstag, Jubiläum und gemeinsamer Rückblick", swatches: ["#f5f0e8", "#8f2f4f", "#b89a68"] },
  { id: "EDITORIAL", name: "LOVD × Phil Gud", description: "Warme Venue-Atmosphäre mit offener Fläche, präziser Typografie und ruhigen Akzenten.", useCase: "Gastronomie, Kultur und hochwertige Kollaborationen", swatches: ["#6A241C", "#FFF9E9", "#C64D3B"] },
  { id: "KOMM_ONE", name: "Komm.ONE PubQuiz", description: "Digitale Markenbühne mit Midnight, Lagoon und präzisen Amarillo-Akzenten.", useCase: "Komm.ONE Veranstaltungen, Workshops und Quizabende", swatches: ["#003A40", "#00B2A9", "#F1C400"] },
] as const satisfies readonly { id: PresentationDesignStyle; name: string; description: string; useCase: string; swatches: readonly string[] }[];

const templateIdByStyle: Record<PresentationDesignStyle, string> = {
  NEON: "ungegoogelt-default",
  CORPORATE: "corporate-reference",
  BIRTHDAY: "birthday-reference",
  EDITORIAL: "lovd-ungegoogelt",
  KOMM_ONE: "komm-one-pubquiz",
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
    ? structuredClone(current.design.storybook ?? {
        occasion: "BIRTHDAY",
        sharedTitle: "Unsere gemeinsame Geschichte",
        motto: "",
        subtitle: "",
        people: [],
        assets: [],
        anecdotes: [],
        chapters: [],
        material: "CREAM_PAPER",
      })
    : null;
  preset.design.stylePreset = style;
  preset.design.composition = structuredClone(presentationDesigns[style].composition);
  return preset;
}

export const compatibleLayoutPresets: Record<PresentationDesignStyle, readonly PresentationTemplateConfig["design"]["composition"]["layoutPreset"][]> = {
  NEON: ["CLASSIC", "IMAGE_FOCUS", "SPLIT"],
  CORPORATE: ["CLASSIC", "SPLIT", "MAGAZINE"],
  BIRTHDAY: ["IMAGE_FOCUS", "MAGAZINE", "COLLAGE"],
  EDITORIAL: ["CLASSIC", "SPLIT", "MAGAZINE"],
  KOMM_ONE: ["CLASSIC", "SPLIT", "IMAGE_FOCUS"],
};
