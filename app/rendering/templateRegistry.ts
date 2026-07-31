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

export type ManagedBlobAssetUrl = `https://${string}.blob.vercel-storage.com/${string}`;
export type TemplateAssetReference = RepositoryAssetPath | ManagedBlobAssetUrl;

export type StorybookPerson = {
  id: string;
  name: string;
  age: string | null;
  subtitle: string | null;
  portrait: TemplateAssetReference | null;
};

export type StorybookMemoryAsset = {
  id: string;
  source: TemplateAssetReference;
  role: "PORTRAIT" | "GROUP" | "MEMORY" | "SOLUTION";
  personIds: string[];
  alt: string;
  caption: string | null;
  year: string | null;
  order: number;
};

export type StorybookAnecdote = {
  id: string;
  text: string;
  personIds: string[];
  year: string | null;
};

export type StorybookChapter = {
  id: string;
  title: string;
  subtitle: string | null;
  personIds: string[];
  order: number;
};

export type StorybookConfiguration = {
  occasion: "BIRTHDAY";
  sharedTitle: string;
  motto: string;
  subtitle: string;
  people: StorybookPerson[];
  assets: StorybookMemoryAsset[];
  anecdotes: StorybookAnecdote[];
  chapters: StorybookChapter[];
  material: "CREAM_PAPER" | "LIGHT_ALBUM" | "LINEN" | "DARK_ALBUM" | "MAGAZINE_WHITE";
};

export type BrandAssetTokens = {
  logo: TemplateAssetReference;
  backgroundImage: TemplateAssetReference | null;
};

export type BrandTokens = {
  colors: BrandColorTokens;
  typography: BrandTypographyTokens;
  radii: BrandRadiusTokens;
  spacing: BrandSpacingTokens;
  assets: BrandAssetTokens;
};

export type PresentationDesignStyle = "NEON" | "CORPORATE" | "BIRTHDAY";

export type PresentationTemplateDesign = {
  stylePreset: PresentationDesignStyle;
  composition: {
    layoutPreset: "CLASSIC" | "IMAGE_FOCUS" | "SPLIT" | "MAGAZINE" | "COLLAGE";
    headerStyle: "BRAND_BAR" | "CORPORATE_BAND" | "BIRTHDAY_HERO";
    footerStyle: "NONE" | "STATUS_LINE" | "PERSONAL_NOTE";
    contentFrame: "NEON_FRAME" | "CORPORATE_PANEL" | "BIRTHDAY_ALBUM";
    mediaTreatment: "GLOW_FRAME" | "RECTANGULAR" | "POLAROID";
    answerTreatment: "NEON_CARDS" | "CORPORATE_ROWS" | "BIRTHDAY_CARDS";
    solutionTreatment: "SPOTLIGHT" | "RESULT_BAND" | "MEMORY";
    decoration: "NONE" | "NEON_ORBITS" | "GEOMETRIC_LINES" | "CONFETTI";
  };
  imagery: {
    heroImage: TemplateAssetReference | null;
    solutionImage: TemplateAssetReference | null;
    decorativeImages: TemplateAssetReference[];
    personalImagePool: TemplateAssetReference[];
    overlay: "NONE" | "SOFT" | "STRONG";
    placement: "BACKGROUND" | "SIDE" | "COLLAGE";
  };
  occasion: {
    personName: string;
    age: string;
    subtitle: string;
    eventTitle: string;
    extraText: string;
    identityPlacement: "HEADER" | "SIDE" | "FOOTER";
  };
  storybook: StorybookConfiguration | null;
};

export type TemplateMessageKey =
  | "presentationDefault"
  | "presentationDark"
  | "presentationCorporate"
  | "presentationBirthday"
  | "answerDefault"
  | "answerMinimal"
  | "answerCorporate"
  | "answerBirthday";

type TemplateMetadata = {
  labelKey: TemplateMessageKey;
  category: "BRANDED" | "MINIMAL";
  selectable: boolean;
  preview: {
    exampleButtonKey: "previewButton";
  };
  displayName?: string;
  moderationVariant?: "BRANDED" | "QUIET";
  design: PresentationTemplateDesign;
};

export type PresentationTemplate = TemplateMetadata & {
  id: string;
  kind: "PRESENTATION";
  variant: "NEON" | "DARK";
  tokens: BrandTokens;
};

export type AnswerFormTemplate = TemplateMetadata & {
  id: string;
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

export const presentationDesigns = {
  NEON: {
    stylePreset: "NEON",
    composition: { layoutPreset: "CLASSIC", headerStyle: "BRAND_BAR", footerStyle: "STATUS_LINE", contentFrame: "NEON_FRAME", mediaTreatment: "GLOW_FRAME", answerTreatment: "NEON_CARDS", solutionTreatment: "SPOTLIGHT", decoration: "NEON_ORBITS" },
    imagery: { heroImage: null, solutionImage: null, decorativeImages: [], personalImagePool: [], overlay: "NONE", placement: "BACKGROUND" },
    occasion: { personName: "", age: "", subtitle: "", eventTitle: "", extraText: "", identityPlacement: "HEADER" },
    storybook: null,
  },
  CORPORATE: {
    stylePreset: "CORPORATE",
    composition: { layoutPreset: "SPLIT", headerStyle: "CORPORATE_BAND", footerStyle: "STATUS_LINE", contentFrame: "CORPORATE_PANEL", mediaTreatment: "RECTANGULAR", answerTreatment: "CORPORATE_ROWS", solutionTreatment: "RESULT_BAND", decoration: "GEOMETRIC_LINES" },
    imagery: { heroImage: null, solutionImage: null, decorativeImages: [], personalImagePool: [], overlay: "SOFT", placement: "SIDE" },
    occasion: { personName: "", age: "", subtitle: "Wissen verbindet", eventTitle: "Corporate Quiz", extraText: "", identityPlacement: "HEADER" },
    storybook: null,
  },
  BIRTHDAY: {
    stylePreset: "BIRTHDAY",
    composition: { layoutPreset: "COLLAGE", headerStyle: "BIRTHDAY_HERO", footerStyle: "PERSONAL_NOTE", contentFrame: "BIRTHDAY_ALBUM", mediaTreatment: "POLAROID", answerTreatment: "BIRTHDAY_CARDS", solutionTreatment: "MEMORY", decoration: "CONFETTI" },
    imagery: { heroImage: "/medien/bilder/unsortiert/1778762143603-img_20140530_143045.jpg", solutionImage: "/medien/bilder/unsortiert/1778787308845-20220503_095407.jpg", decorativeImages: [], personalImagePool: ["/medien/bilder/unsortiert/1778762143603-img_20140530_143045.jpg", "/medien/bilder/unsortiert/1778762097227-20190714_112415.jpg", "/medien/bilder/unsortiert/1778787308845-20220503_095407.jpg"], overlay: "SOFT", placement: "COLLAGE" },
    occasion: { personName: "Alex", age: "40", subtitle: "Ein Quiz voller Erinnerungen", eventTitle: "Geburtstagsquiz", extraText: "Schön, dass ihr mitfeiert!", identityPlacement: "HEADER" },
    storybook: {
      occasion: "BIRTHDAY",
      sharedTitle: "Alex’ Erinnerungsquiz",
      motto: "Ein Quiz voller Erinnerungen",
      subtitle: "Schön, dass ihr mitfeiert!",
      people: [{ id: "alex", name: "Alex", age: "40", subtitle: null, portrait: "/medien/bilder/unsortiert/1778762143603-img_20140530_143045.jpg" }],
      assets: [
        { id: "alex-portrait", source: "/medien/bilder/unsortiert/1778762143603-img_20140530_143045.jpg", role: "PORTRAIT", personIds: ["alex"], alt: "Porträt von Alex", caption: null, year: "2014", order: 0 },
        { id: "birthday-memory", source: "/medien/bilder/unsortiert/1778787308845-20220503_095407.jpg", role: "SOLUTION", personIds: ["alex"], alt: "Gemeinsame Reiseerinnerung", caption: "Ein Tag, den niemand vergisst", year: "2022", order: 1 },
      ],
      anecdotes: [],
      chapters: [],
      material: "CREAM_PAPER",
    },
  },
} as const satisfies Record<PresentationDesignStyle, PresentationTemplateDesign>;

const presentation = [
  {
    id: "ungegoogelt-default",
    kind: "PRESENTATION",
    variant: "NEON",
    labelKey: "presentationDefault",
    category: "BRANDED",
    selectable: true,
    preview: { exampleButtonKey: "previewButton" },
    design: presentationDesigns.NEON,
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
    design: presentationDesigns.CORPORATE,
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
  {
    id: "corporate-reference",
    kind: "PRESENTATION",
    variant: "DARK",
    labelKey: "presentationCorporate",
    category: "MINIMAL",
    selectable: true,
    preview: { exampleButtonKey: "previewButton" },
    design: presentationDesigns.CORPORATE,
    tokens: {
      ...sharedSizing,
      typography: { family: "system-ui, sans-serif", displayWeight: 800, bodyWeight: 400 },
      radii: { small: "0.5rem", medium: "0.75rem", large: "1rem" },
      spacing: { small: "0.75rem", medium: "1.5rem", large: "2.5rem" },
      colors: { primary: "#1d4ed8", secondary: "#334155", accent: "#0ea5e9", background: "#f1f5f9", surface: "#ffffff", surfaceStrong: "#e2e8f0", text: "#0f172a", textMuted: "#475569", border: "#94a3b8", success: "#047857", warning: "#a16207", danger: "#b91c1c" },
    },
  },
  {
    id: "birthday-reference",
    kind: "PRESENTATION",
    variant: "NEON",
    labelKey: "presentationBirthday",
    category: "BRANDED",
    selectable: true,
    preview: { exampleButtonKey: "previewButton" },
    design: presentationDesigns.BIRTHDAY,
    tokens: {
      ...sharedSizing,
      colors: { primary: "#be185d", secondary: "#7c3aed", accent: "#f59e0b", background: "#fff7ed", surface: "#ffffff", surfaceStrong: "#fce7f3", text: "#4c1d3d", textMuted: "#7c2d5b", border: "#f9a8d4", success: "#15803d", warning: "#b45309", danger: "#be123c" },
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
    design: presentationDesigns.NEON,
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
    design: presentationDesigns.CORPORATE,
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
  {
    id: "corporate-reference", kind: "ANSWER_FORM", variant: "MINIMAL",
    labelKey: "answerCorporate", category: "MINIMAL", selectable: true,
    preview: { exampleButtonKey: "previewButton" }, design: presentationDesigns.CORPORATE,
    tokens: { ...sharedSizing, typography: { family: "system-ui, sans-serif", displayWeight: 800, bodyWeight: 400 }, radii: { small: "0.5rem", medium: "0.75rem", large: "1rem" }, colors: { primary: "#1d4ed8", secondary: "#334155", accent: "#0ea5e9", background: "#f1f5f9", surface: "#ffffff", surfaceStrong: "#e2e8f0", text: "#0f172a", textMuted: "#475569", border: "#94a3b8", success: "#047857", warning: "#a16207", danger: "#b91c1c" } },
  },
  {
    id: "birthday-reference", kind: "ANSWER_FORM", variant: "BRANDED",
    labelKey: "answerBirthday", category: "BRANDED", selectable: true,
    preview: { exampleButtonKey: "previewButton" }, design: presentationDesigns.BIRTHDAY,
    tokens: { ...sharedSizing, colors: { primary: "#be185d", secondary: "#7c3aed", accent: "#f59e0b", background: "#fff7ed", surface: "#ffffff", surfaceStrong: "#fce7f3", text: "#4c1d3d", textMuted: "#7c2d5b", border: "#f9a8d4", success: "#15803d", warning: "#b45309", danger: "#be123c" } },
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
