import type {
  AnswerFormTemplate,
  BrandTokens,
  PresentationTemplateDesign,
  PresentationTemplate,
} from "@/app/rendering/templateRegistry";
import { presentationDesigns } from "@/app/rendering/templateRegistry";

export const PRESENTATION_TEMPLATE_CONTRACT_VERSION = 1 as const;

export const presentationTemplateStatuses = [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
] as const;

export type PresentationTemplateStatus =
  (typeof presentationTemplateStatuses)[number];

export type PresentationTemplateConfig = {
  version: typeof PRESENTATION_TEMPLATE_CONTRACT_VERSION;
  tokens: BrandTokens;
  surfaces: {
    presentation: PresentationTemplate["variant"];
    moderation: "BRANDED" | "QUIET";
    answerForm: AnswerFormTemplate["variant"];
  };
  design: PresentationTemplateDesign;
};

export type ManagedPresentationTemplate = {
  id: string;
  name: string;
  description: string | null;
  status: PresentationTemplateStatus | "SYSTEM";
  source: "SYSTEM" | "USER";
  isSystem: boolean;
  contractVersion: number;
  config: PresentationTemplateConfig;
  tags: readonly string[];
  sourceTemplateId: string | null;
  creatorName: string | null;
  updatedAt: Date | null;
  usageCount: number;
};

export type PresentationTemplateDraft = {
  id: string;
  name: string;
  description: string;
  status: PresentationTemplateStatus;
  tags: string[];
  sourceTemplateId: string | null;
  config: PresentationTemplateConfig;
};

export type TemplateValidationIssue = {
  field: string;
  message: string;
};

export type TemplateValidationResult =
  | {
      ok: true;
      value: PresentationTemplateDraft;
      warnings: TemplateValidationIssue[];
    }
  | {
      ok: false;
      errors: TemplateValidationIssue[];
      warnings: TemplateValidationIssue[];
    };

const allowedFonts = [
  "Arial, Helvetica, sans-serif",
  "system-ui, sans-serif",
] as const;

const displayWeights = [700, 800, 900] as const;
const bodyWeights = [400, 500, 600] as const;
const smallRadii = ["0.5rem", "0.75rem"] as const;
const mediumRadii = ["0.75rem", "1rem", "1.5rem"] as const;
const largeRadii = ["1rem", "1.5rem", "2rem"] as const;
const smallSpacing = ["0.5rem", "0.75rem"] as const;
const mediumSpacing = ["1rem", "1.5rem"] as const;
const largeSpacing = ["1.5rem", "2rem", "2.5rem"] as const;

export const presentationTemplateOptions = {
  fonts: allowedFonts,
  displayWeights,
  bodyWeights,
  radiusPresets: {
    COMPACT: {
      small: "0.5rem",
      medium: "0.75rem",
      large: "1rem",
    },
    ROUNDED: {
      small: "0.75rem",
      medium: "1.5rem",
      large: "2rem",
    },
  },
  spacingPresets: {
    COMPACT: {
      small: "0.5rem",
      medium: "1rem",
      large: "1.5rem",
    },
    COMFORTABLE: {
      small: "0.75rem",
      medium: "1.5rem",
      large: "2rem",
    },
    SPACIOUS: {
      small: "0.75rem",
      medium: "1.5rem",
      large: "2.5rem",
    },
  },
} as const;

export const defaultPresentationTemplateConfig: PresentationTemplateConfig = {
  version: PRESENTATION_TEMPLATE_CONTRACT_VERSION,
  tokens: {
    colors: {
      primary: "#38e8ff",
      secondary: "#ff3bd4",
      accent: "#ffd83b",
      background: "#080014",
      surface: "#020617",
      surfaceStrong: "#000000",
      text: "#ffffff",
      textMuted: "#cbd5e1",
      border: "#38e8ff",
      success: "#42ff5e",
      warning: "#ffd83b",
      danger: "#ff4a4a",
    },
    typography: {
      family: "Arial, Helvetica, sans-serif",
      displayWeight: 900,
      bodyWeight: 400,
    },
    radii: presentationTemplateOptions.radiusPresets.ROUNDED,
    spacing: presentationTemplateOptions.spacingPresets.COMFORTABLE,
    assets: {
      logo: "/logo_transparent.png",
      backgroundImage: null,
    },
  },
  surfaces: {
    presentation: "NEON",
    moderation: "BRANDED",
    answerForm: "BRANDED",
  },
  design: structuredClone(presentationDesigns.NEON),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHexColor(value: unknown): value is `#${string}` {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function rejectUnknownFields(record: Record<string, unknown>, allowed: readonly string[], field: string, errors: TemplateValidationIssue[]) {
  for (const key of Object.keys(record)) if (!allowed.includes(key)) errors.push({ field: `${field}.${key}`, message: "Freie oder unbekannte Konfigurationsfelder sind nicht erlaubt." });
}

function isSafeAssetReference(value: unknown, nullable = false) {
  if (nullable && value === null) return true;
  return (
    typeof value === "string" &&
    /^\/(?!\/)[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp|svg)$/i.test(value)
  );
}

function normalizeDesign(value: unknown, presentationVariant: unknown) {
  const fallback = presentationVariant === "DARK"
    ? presentationDesigns.CORPORATE
    : presentationDesigns.NEON;
  if (!isRecord(value)) return structuredClone(fallback);
  return {
    ...structuredClone(fallback),
    ...value,
    composition: { ...fallback.composition, ...(isRecord(value.composition) ? value.composition : {}) },
    imagery: { ...fallback.imagery, ...(isRecord(value.imagery) ? value.imagery : {}) },
    occasion: { ...fallback.occasion, ...(isRecord(value.occasion) ? value.occasion : {}) },
  } as PresentationTemplateDesign;
}

export function normalizePresentationTemplateConfig(value: unknown): PresentationTemplateConfig | null {
  if (!isRecord(value) || !isRecord(value.surfaces)) return null;
  return {
    ...(value as unknown as Omit<PresentationTemplateConfig, "design">),
    design: normalizeDesign(value.design, value.surfaces.presentation),
  };
}

function validateDesign(value: unknown) {
  const errors: TemplateValidationIssue[] = [];
  if (!isRecord(value) || !isRecord(value.composition) || !isRecord(value.imagery) || !isRecord(value.occasion)) {
    return [{ field: "config.design", message: "Semantische Designbausteine fehlen." }];
  }
  const style = value.stylePreset;
  if (!["NEON", "CORPORATE", "BIRTHDAY"].includes(String(style))) {
    errors.push({ field: "config.design.stylePreset", message: "Unbekannter Designstil." });
    return errors;
  }
  const expected = presentationDesigns[style as keyof typeof presentationDesigns].composition;
  const allowedKeys = {
    design: ["stylePreset", "composition", "imagery", "occasion"],
    composition: ["layoutPreset", "headerStyle", "footerStyle", "contentFrame", "mediaTreatment", "answerTreatment", "solutionTreatment", "decoration"],
    imagery: ["heroImage", "decorativeImages", "personalImagePool", "overlay", "placement"],
    occasion: ["personName", "age", "subtitle", "eventTitle", "extraText", "identityPlacement"],
  } as const;
  for (const [group, record] of [["design", value], ["composition", value.composition], ["imagery", value.imagery], ["occasion", value.occasion]] as const) {
    for (const key of Object.keys(record)) if (!(allowedKeys[group] as readonly string[]).includes(key)) errors.push({ field: `config.design.${group}.${key}`, message: "Freie oder ausführbare Designfelder sind nicht erlaubt." });
  }
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    const allowed = {
      layoutPreset: ["CLASSIC", "IMAGE_FOCUS", "SPLIT", "MAGAZINE", "COLLAGE"], headerStyle: ["BRAND_BAR", "CORPORATE_BAND", "BIRTHDAY_HERO"], footerStyle: ["NONE", "STATUS_LINE", "PERSONAL_NOTE"],
      contentFrame: ["NEON_FRAME", "CORPORATE_PANEL", "BIRTHDAY_ALBUM"], mediaTreatment: ["GLOW_FRAME", "RECTANGULAR", "POLAROID"],
      answerTreatment: ["NEON_CARDS", "CORPORATE_ROWS", "BIRTHDAY_CARDS"], solutionTreatment: ["SPOTLIGHT", "RESULT_BAND", "MEMORY"],
      decoration: ["NONE", "NEON_ORBITS", "GEOMETRIC_LINES", "CONFETTI"],
    }[key] as readonly string[];
    if (!allowed.includes(String(value.composition[key]))) errors.push({ field: `config.design.composition.${key}`, message: "Unbekannter Kompositionsbaustein." });
  }
  const compatibleLayouts = {
    NEON: ["CLASSIC", "IMAGE_FOCUS", "SPLIT"],
    CORPORATE: ["CLASSIC", "SPLIT", "MAGAZINE"],
    BIRTHDAY: ["IMAGE_FOCUS", "MAGAZINE", "COLLAGE"],
  }[style as "NEON" | "CORPORATE" | "BIRTHDAY"];
  if (!compatibleLayouts.includes(String(value.composition.layoutPreset))) errors.push({ field: "config.design.composition.layoutPreset", message: "Der Aufbau passt nicht zum gewählten Designstil." });
  for (const key of ["headerStyle", "contentFrame", "mediaTreatment", "answerTreatment", "solutionTreatment"] as const) {
    if (value.composition[key] !== expected[key]) errors.push({ field: `config.design.composition.${key}`, message: "Der Baustein passt nicht zum gewählten Designstil." });
  }
  const imagery = value.imagery;
  for (const key of ["decorativeImages", "personalImagePool"] as const) {
    if (!Array.isArray(imagery[key]) || imagery[key].length > 24 || !imagery[key].every((asset) => isSafeAssetReference(asset))) {
      errors.push({ field: `config.design.imagery.${key}`, message: "Der Bilderpool darf höchstens 24 sichere repository-relative Bildpfade enthalten." });
    }
  }
  if (!isSafeAssetReference(imagery.heroImage, true) || !["NONE", "SOFT", "STRONG"].includes(String(imagery.overlay)) || !["BACKGROUND", "SIDE", "COLLAGE"].includes(String(imagery.placement))) {
    errors.push({ field: "config.design.imagery", message: "Bildwelt enthält einen nicht unterstützten Wert." });
  }
  for (const key of ["personName", "age", "subtitle", "eventTitle", "extraText"] as const) {
    if (typeof value.occasion[key] !== "string" || value.occasion[key].length > (key === "extraText" ? 240 : 120)) errors.push({ field: `config.design.occasion.${key}`, message: "Personalisierung ist zu lang oder ungültig." });
  }
  if (!["HEADER", "SIDE", "FOOTER"].includes(String(value.occasion.identityPlacement))) errors.push({ field: "config.design.occasion.identityPlacement", message: "Unbekannte Platzierung." });
  return errors;
}

function hexLuminance(value: string) {
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16) / 255,
  );
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string) {
  const first = hexLuminance(foreground);
  const second = hexLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function validateConfig(value: unknown) {
  const errors: TemplateValidationIssue[] = [];
  if (!isRecord(value)) {
    return { errors: [{ field: "config", message: "Theme-Konfiguration fehlt." }] };
  }
  rejectUnknownFields(value, ["version", "tokens", "surfaces", "design"], "config", errors);
  if (value.version !== PRESENTATION_TEMPLATE_CONTRACT_VERSION) {
    errors.push({ field: "config.version", message: "Unbekannte Vertragsversion." });
  }
  const tokens = value.tokens;
  const surfaces = value.surfaces;
  errors.push(...validateDesign(value.design));
  if (!isRecord(tokens)) {
    errors.push({ field: "config.tokens", message: "Theme-Tokens fehlen." });
    return { errors };
  }
  rejectUnknownFields(tokens, ["colors", "typography", "radii", "spacing", "assets"], "config.tokens", errors);
  const colors = tokens.colors;
  const requiredColors = [
    "primary",
    "secondary",
    "accent",
    "background",
    "surface",
    "surfaceStrong",
    "text",
    "textMuted",
    "border",
    "success",
    "warning",
    "danger",
  ] as const;
  if (!isRecord(colors)) {
    errors.push({ field: "config.tokens.colors", message: "Farben fehlen." });
  } else {
    for (const key of requiredColors) {
      if (!isHexColor(colors[key])) {
        errors.push({ field: `config.tokens.colors.${key}`, message: "Farbe muss als #RRGGBB angegeben werden." });
      }
    }
    for (const key of Object.keys(colors)) {
      if (!requiredColors.includes(key as (typeof requiredColors)[number])) {
        errors.push({ field: `config.tokens.colors.${key}`, message: "Unbekanntes Farbtoken." });
      }
    }
  }
  const typography = tokens.typography;
  if (isRecord(typography)) rejectUnknownFields(typography, ["family", "displayWeight", "bodyWeight"], "config.tokens.typography", errors);
  if (
    !isRecord(typography) ||
    !allowedFonts.includes(typography.family as (typeof allowedFonts)[number]) ||
    !displayWeights.includes(typography.displayWeight as (typeof displayWeights)[number]) ||
    !bodyWeights.includes(typography.bodyWeight as (typeof bodyWeights)[number])
  ) {
    errors.push({ field: "config.tokens.typography", message: "Typografie enthält einen nicht unterstützten Wert." });
  }
  const radii = tokens.radii;
  if (isRecord(radii)) rejectUnknownFields(radii, ["small", "medium", "large"], "config.tokens.radii", errors);
  if (
    !isRecord(radii) ||
    !smallRadii.includes(radii.small as (typeof smallRadii)[number]) ||
    !mediumRadii.includes(radii.medium as (typeof mediumRadii)[number]) ||
    !largeRadii.includes(radii.large as (typeof largeRadii)[number])
  ) {
    errors.push({ field: "config.tokens.radii", message: "Eckenprofil ist ungültig." });
  }
  const spacing = tokens.spacing;
  if (isRecord(spacing)) rejectUnknownFields(spacing, ["small", "medium", "large"], "config.tokens.spacing", errors);
  if (
    !isRecord(spacing) ||
    !smallSpacing.includes(spacing.small as (typeof smallSpacing)[number]) ||
    !mediumSpacing.includes(spacing.medium as (typeof mediumSpacing)[number]) ||
    !largeSpacing.includes(spacing.large as (typeof largeSpacing)[number])
  ) {
    errors.push({ field: "config.tokens.spacing", message: "Abstandsprofil ist ungültig." });
  }
  const assets = tokens.assets;
  if (isRecord(assets)) rejectUnknownFields(assets, ["logo", "backgroundImage"], "config.tokens.assets", errors);
  if (
    !isRecord(assets) ||
    !isSafeAssetReference(assets.logo) ||
    !isSafeAssetReference(assets.backgroundImage, true)
  ) {
    errors.push({ field: "config.tokens.assets", message: "Assets müssen sichere repository-relative Bildpfade verwenden." });
  }
  if (isRecord(surfaces)) rejectUnknownFields(surfaces, ["presentation", "moderation", "answerForm"], "config.surfaces", errors);
  if (
    !isRecord(surfaces) ||
    !["NEON", "DARK"].includes(String(surfaces.presentation)) ||
    !["BRANDED", "QUIET"].includes(String(surfaces.moderation)) ||
    !["BRANDED", "MINIMAL"].includes(String(surfaces.answerForm))
  ) {
    errors.push({ field: "config.surfaces", message: "Unbekannte Oberflächenvariante." });
  }
  return { errors };
}

export function validatePresentationTemplateDraft(
  input: PresentationTemplateDraft,
): TemplateValidationResult {
  const errors: TemplateValidationIssue[] = [];
  const warnings: TemplateValidationIssue[] = [];
  const normalized: PresentationTemplateDraft = {
    ...input,
    id: input.id.trim().toLowerCase(),
    name: input.name.trim(),
    description: input.description.trim(),
    tags: Array.from(new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))),
  };

  if (!normalized.name) errors.push({ field: "name", message: "Name ist erforderlich." });
  else if (normalized.name.length > 120) errors.push({ field: "name", message: "Name darf maximal 120 Zeichen enthalten." });
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(normalized.id)) {
    errors.push({ field: "id", message: "Die ID muss mit einem Buchstaben beginnen und 3–64 Kleinbuchstaben, Zahlen oder Bindestriche enthalten." });
  }
  if (normalized.description.length > 1000) {
    errors.push({ field: "description", message: "Beschreibung darf maximal 1000 Zeichen enthalten." });
  }
  if (!presentationTemplateStatuses.includes(normalized.status)) {
    errors.push({ field: "status", message: "Unbekannter Status." });
  }
  errors.push(...validateConfig(normalized.config).errors);

  const unsafeColors = (
    normalized.config as unknown as { tokens?: { colors?: unknown } }
  )?.tokens?.colors;
  if (isRecord(unsafeColors) && Object.values(unsafeColors).every(isHexColor)) {
    const colors = unsafeColors as PresentationTemplateConfig["tokens"]["colors"];
    const contrastChecks = [
      ["Haupttext auf Hintergrund", colors.text, colors.background],
      ["Haupttext auf Oberfläche", colors.text, colors.surface],
      ["Text auf Primärfarbe", colors.background, colors.primary],
      ["Sekundärtext auf Oberfläche", colors.textMuted, colors.surface],
      ["Erfolg auf Hintergrund", colors.success, colors.background],
      ["Warnung auf Hintergrund", colors.warning, colors.background],
      ["Fehler auf Hintergrund", colors.danger, colors.background],
    ] as const;
    for (const [label, foreground, background] of contrastChecks) {
      const ratio = contrastRatio(foreground, background);
      if (ratio < 3) {
        const issue = { field: "config.tokens.colors", message: `${label}: Kontrast ${ratio.toFixed(1)}:1 ist deutlich zu niedrig.` };
        if (normalized.status === "ACTIVE") errors.push(issue);
        else warnings.push(issue);
      } else if (ratio < 4.5) {
        warnings.push({ field: "config.tokens.colors", message: `${label}: Kontrast ${ratio.toFixed(1)}:1 sollte verbessert werden.` });
      }
    }
  }

  return errors.length > 0
    ? { ok: false, errors, warnings }
    : { ok: true, value: normalized, warnings };
}

export function parsePresentationTemplateConfig(
  value: unknown,
): PresentationTemplateConfig | null {
  const normalizedConfig = normalizePresentationTemplateConfig(value);
  if (!normalizedConfig) return null;
  const draft: PresentationTemplateDraft = {
    id: "parse-check",
    name: "Parse check",
    description: "",
    status: "DRAFT",
    tags: [],
    sourceTemplateId: null,
    config: normalizedConfig,
  };
  const result = validatePresentationTemplateDraft(draft);
  return result.ok ? result.value.config : null;
}

export function toRuntimePresentationTemplate(
  template: Pick<ManagedPresentationTemplate, "id" | "name" | "config">,
): PresentationTemplate {
  return {
    id: template.id,
    kind: "PRESENTATION",
    variant: template.config.surfaces.presentation,
    labelKey: "presentationDefault",
    category: "BRANDED",
    selectable: true,
    preview: { exampleButtonKey: "previewButton" },
    tokens: template.config.tokens,
    displayName: template.name,
    moderationVariant: template.config.surfaces.moderation,
    design: template.config.design,
  };
}

export function toRuntimeAnswerFormTemplate(
  template: Pick<ManagedPresentationTemplate, "id" | "name" | "config">,
): AnswerFormTemplate {
  return {
    id: template.id,
    kind: "ANSWER_FORM",
    variant: template.config.surfaces.answerForm,
    labelKey: "answerDefault",
    category: "BRANDED",
    selectable: true,
    preview: { exampleButtonKey: "previewButton" },
    tokens: template.config.tokens,
    displayName: template.name,
    design: template.config.design,
  };
}
