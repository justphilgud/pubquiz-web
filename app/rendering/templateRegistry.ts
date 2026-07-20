import type { AppLocale } from "@/app/i18n/locale";

export type TemplateSource = "QUIZ" | "EVENT_SERIES" | "SYSTEM";

export type BrandColorTokens = {
  primary: `#${string}`;
  secondary: `#${string}`;
  accent: `#${string}`;
  background: `#${string}`;
  surface: `#${string}`;
  surfaceStrong: `#${string}`;
  text: `#${string}`;
  textMuted: `#${string}`;
  border: `#${string}`;
  success: `#${string}`;
  warning: `#${string}`;
  danger: `#${string}`;
};

export type BrandTypographyTokens = {
  family: "Arial, Helvetica, sans-serif" | "system-ui, sans-serif";
  displayWeight: 700 | 800 | 900;
  bodyWeight: 400 | 500 | 600;
};

export type BrandRadiusTokens = {
  small: "0.5rem" | "0.75rem";
  medium: "0.75rem" | "1rem" | "1.5rem";
  large: "1rem" | "1.5rem" | "2rem";
};

export type BrandSpacingTokens = {
  small: "0.5rem" | "0.75rem";
  medium: "1rem" | "1.5rem";
  large: "1.5rem" | "2rem" | "2.5rem";
};

export type RepositoryAssetPath = `/${string}`;

export type BrandAssetTokens = {
  logo: RepositoryAssetPath;
  backgroundImage: RepositoryAssetPath | null;
};

export type BrandTokens = {
  colors: BrandColorTokens;
  typography: BrandTypographyTokens;
  radii: BrandRadiusTokens;
  spacing: BrandSpacingTokens;
  assets: BrandAssetTokens;
};

export type TemplateMessageKey =
  | "presentationDefault"
  | "presentationDark"
  | "answerDefault"
  | "answerMinimal";

type TemplateMetadata = {
  labelKey: TemplateMessageKey;
  category: "BRANDED" | "MINIMAL";
  selectable: boolean;
  preview: {
    exampleButtonKey: "previewButton";
  };
};

export type PresentationTemplate = TemplateMetadata & {
  id: "ungegoogelt-default" | "ungegoogelt-dark";
  kind: "PRESENTATION";
  variant: "NEON" | "DARK";
  tokens: BrandTokens;
};

export type AnswerFormTemplate = TemplateMetadata & {
  id: "ungegoogelt-default" | "minimal";
  kind: "ANSWER_FORM";
  variant: "BRANDED" | "MINIMAL";
  tokens: BrandTokens;
};

const sharedSizing = {
  typography: {
    family: "Arial, Helvetica, sans-serif",
    displayWeight: 900,
    bodyWeight: 400,
  },
  radii: { small: "0.75rem", medium: "1.5rem", large: "2rem" },
  spacing: { small: "0.75rem", medium: "1.5rem", large: "2rem" },
  assets: { logo: "/logo_transparent.png", backgroundImage: null },
} as const;

const presentation = [
  {
    id: "ungegoogelt-default",
    kind: "PRESENTATION",
    variant: "NEON",
    labelKey: "presentationDefault",
    category: "BRANDED",
    selectable: true,
    preview: { exampleButtonKey: "previewButton" },
    tokens: {
      ...sharedSizing,
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
    },
  },
  {
    id: "ungegoogelt-dark",
    kind: "PRESENTATION",
    variant: "DARK",
    labelKey: "presentationDark",
    category: "MINIMAL",
    selectable: true,
    preview: { exampleButtonKey: "previewButton" },
    tokens: {
      ...sharedSizing,
      radii: { small: "0.5rem", medium: "0.75rem", large: "1rem" },
      colors: {
        primary: "#a78bfa",
        secondary: "#60a5fa",
        accent: "#f8fafc",
        background: "#020617",
        surface: "#0f172a",
        surfaceStrong: "#111827",
        text: "#f8fafc",
        textMuted: "#94a3b8",
        border: "#475569",
        success: "#34d399",
        warning: "#fbbf24",
        danger: "#fb7185",
      },
    },
  },
] as const satisfies readonly PresentationTemplate[];

const answerForm = [
  {
    id: "ungegoogelt-default",
    kind: "ANSWER_FORM",
    variant: "BRANDED",
    labelKey: "answerDefault",
    category: "BRANDED",
    selectable: true,
    preview: { exampleButtonKey: "previewButton" },
    tokens: {
      ...sharedSizing,
      colors: {
        primary: "#0f172a",
        secondary: "#047857",
        accent: "#16a34a",
        background: "#f1f5f9",
        surface: "#ffffff",
        surfaceStrong: "#f8fafc",
        text: "#0f172a",
        textMuted: "#475569",
        border: "#cbd5e1",
        success: "#047857",
        warning: "#a16207",
        danger: "#b91c1c",
      },
    },
  },
  {
    id: "minimal",
    kind: "ANSWER_FORM",
    variant: "MINIMAL",
    labelKey: "answerMinimal",
    category: "MINIMAL",
    selectable: true,
    preview: { exampleButtonKey: "previewButton" },
    tokens: {
      ...sharedSizing,
      typography: {
        family: "system-ui, sans-serif",
        displayWeight: 700,
        bodyWeight: 400,
      },
      radii: { small: "0.5rem", medium: "0.75rem", large: "1rem" },
      spacing: { small: "0.5rem", medium: "1rem", large: "1.5rem" },
      assets: { logo: "/logo_schriftzug_transparent.png", backgroundImage: null },
      colors: {
        primary: "#1d4ed8",
        secondary: "#334155",
        accent: "#2563eb",
        background: "#ffffff",
        surface: "#ffffff",
        surfaceStrong: "#f8fafc",
        text: "#111827",
        textMuted: "#475569",
        border: "#94a3b8",
        success: "#047857",
        warning: "#92400e",
        danger: "#b91c1c",
      },
    },
  },
] as const satisfies readonly AnswerFormTemplate[];

export const templateRegistry = { presentation, answerForm } as const;

export const SYSTEM_PRESENTATION_TEMPLATE_ID: PresentationTemplate["id"] =
  "ungegoogelt-default";
export const SYSTEM_ANSWER_FORM_TEMPLATE_ID: AnswerFormTemplate["id"] =
  "ungegoogelt-default";

export function getPresentationTemplate(id: string | null | undefined) {
  return templateRegistry.presentation.find((template) => template.id === id);
}

export function getAnswerFormTemplate(id: string | null | undefined) {
  return templateRegistry.answerForm.find((template) => template.id === id);
}

export function isSelectablePresentationTemplateId(
  id: unknown,
): id is PresentationTemplate["id"] {
  return typeof id === "string" && Boolean(
    getPresentationTemplate(id)?.selectable,
  );
}

export function isSelectableAnswerFormTemplateId(
  id: unknown,
): id is AnswerFormTemplate["id"] {
  return typeof id === "string" && Boolean(getAnswerFormTemplate(id)?.selectable);
}

export function localizeTemplate(
  template: PresentationTemplate | AnswerFormTemplate,
  locale: AppLocale,
  messages: Record<TemplateMessageKey, { label: string; description: string }>,
) {
  void locale;
  return { ...template, ...messages[template.labelKey] };
}
