import type { CSSProperties } from "react";

import type {
  AnswerFormTemplate,
  PresentationTemplate,
  PresentationTemplateDesign,
  TemplateSource,
} from "../templateRegistry";
import type { ResolvedTemplate } from "../templateResolver";

export type ResolvedQuizTheme = {
  version: 1;
  identity: {
    displayName: string;
    logoUrl: string | null;
  };
  source: {
    presentationTemplateId: PresentationTemplate["id"];
    answerFormTemplateId: AnswerFormTemplate["id"];
    presentationSource: TemplateSource;
    answerFormSource: TemplateSource;
    presentationUsedFallback: boolean;
    answerFormUsedFallback: boolean;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    surfaceStrong: string;
    text: string;
    textMuted: string;
    border: string;
  };
  semantic: {
    success: string;
    warning: string;
    danger: string;
    focus: string;
  };
  appearance: {
    mode: "LIGHT" | "DARK";
    typographyPreset: "BRAND_DISPLAY" | "SYSTEM";
    fontFamily: string;
    displayWeight: number;
    bodyWeight: number;
    radiusPreset: "ROUNDED" | "COMPACT";
    densityPreset: "COMFORTABLE" | "COMPACT";
    radii: {
      small: string;
      medium: string;
      large: string;
    };
    spacing: {
      small: string;
      medium: string;
      large: string;
    };
  };
  assets: {
    backgroundImageUrl: string | null;
  };
  design: PresentationTemplateDesign;
  presentation: {
    variant: PresentationTemplate["variant"];
  };
  moderation: {
    variant: "BRANDED" | "QUIET";
  };
  answerForm: {
    variant: AnswerFormTemplate["variant"];
  };
};

export type ResolveQuizThemeInput = {
  displayName: string;
  logoUrl?: string | null;
  presentation: ResolvedTemplate<PresentationTemplate>;
  answerForm: ResolvedTemplate<AnswerFormTemplate>;
};

export function resolveQuizTheme({
  displayName,
  logoUrl,
  presentation,
  answerForm,
}: ResolveQuizThemeInput): ResolvedQuizTheme {
  const identityTokens = presentation.template.tokens;
  const answerFormIsCompact = answerForm.template.variant === "MINIMAL";

  return {
    version: 1,
    identity: {
      displayName,
      logoUrl: logoUrl?.trim() || identityTokens.assets.logo || null,
    },
    source: {
      presentationTemplateId: presentation.template.id,
      answerFormTemplateId: answerForm.template.id,
      presentationSource: presentation.source,
      answerFormSource: answerForm.source,
      presentationUsedFallback: presentation.usedFallback,
      answerFormUsedFallback: answerForm.usedFallback,
    },
    colors: {
      primary: identityTokens.colors.primary,
      secondary: identityTokens.colors.secondary,
      accent: identityTokens.colors.accent,
      background: identityTokens.colors.background,
      surface: identityTokens.colors.surface,
      surfaceStrong: identityTokens.colors.surfaceStrong,
      text: identityTokens.colors.text,
      textMuted: identityTokens.colors.textMuted,
      border: identityTokens.colors.border,
    },
    semantic: {
      success: identityTokens.colors.success,
      warning: identityTokens.colors.warning,
      danger: identityTokens.colors.danger,
      focus: identityTokens.colors.primary,
    },
    appearance: {
      mode: presentation.template.variant === "DARK" ? "DARK" : "LIGHT",
      typographyPreset:
        identityTokens.typography.family === "system-ui, sans-serif"
          ? "SYSTEM"
          : "BRAND_DISPLAY",
      fontFamily: identityTokens.typography.family,
      displayWeight: identityTokens.typography.displayWeight,
      bodyWeight: identityTokens.typography.bodyWeight,
      radiusPreset:
        presentation.template.variant === "DARK" ? "COMPACT" : "ROUNDED",
      densityPreset: answerFormIsCompact ? "COMPACT" : "COMFORTABLE",
      radii: identityTokens.radii,
      spacing: answerFormIsCompact
        ? answerForm.template.tokens.spacing
        : identityTokens.spacing,
    },
    assets: {
      backgroundImageUrl: identityTokens.assets.backgroundImage,
    },
    design: structuredClone(presentation.template.design),
    presentation: {
      variant: presentation.template.variant,
    },
    moderation: {
      variant: presentation.template.moderationVariant ?? "BRANDED",
    },
    answerForm: {
      variant: answerForm.template.variant,
    },
  };
}

export type QuizThemeCssProperties = CSSProperties & {
  [key: `--quiz-${string}`]: string | number;
  [key: `--brand-${string}`]: string | number;
};

export function quizThemeStyle(theme: ResolvedQuizTheme): QuizThemeCssProperties {
  const style: QuizThemeCssProperties = {
    "--quiz-primary": theme.colors.primary,
    "--quiz-secondary": theme.colors.secondary,
    "--quiz-accent": theme.colors.accent,
    "--quiz-background": theme.colors.background,
    "--quiz-surface": theme.colors.surface,
    "--quiz-surface-strong": theme.colors.surfaceStrong,
    "--quiz-text": theme.colors.text,
    "--quiz-text-muted": theme.colors.textMuted,
    "--quiz-border": theme.colors.border,
    "--quiz-success": theme.semantic.success,
    "--quiz-warning": theme.semantic.warning,
    "--quiz-danger": theme.semantic.danger,
    "--quiz-focus": theme.semantic.focus,
    "--quiz-radius-small": theme.appearance.radii.small,
    "--quiz-radius-medium": theme.appearance.radii.medium,
    "--quiz-radius-large": theme.appearance.radii.large,
    "--quiz-space-small": theme.appearance.spacing.small,
    "--quiz-space-medium": theme.appearance.spacing.medium,
    "--quiz-space-large": theme.appearance.spacing.large,
    "--quiz-font-family": theme.appearance.fontFamily,
    "--quiz-display-weight": theme.appearance.displayWeight,
    "--quiz-body-weight": theme.appearance.bodyWeight,
    // Compatibility aliases for the existing scoped presentation/answer CSS.
    "--brand-primary": theme.colors.primary,
    "--brand-secondary": theme.colors.secondary,
    "--brand-accent": theme.colors.accent,
    "--brand-background": theme.colors.background,
    "--brand-surface": theme.colors.surface,
    "--brand-surface-strong": theme.colors.surfaceStrong,
    "--brand-text": theme.colors.text,
    "--brand-text-muted": theme.colors.textMuted,
    "--brand-border": theme.colors.border,
    "--brand-success": theme.semantic.success,
    "--brand-warning": theme.semantic.warning,
    "--brand-danger": theme.semantic.danger,
    "--brand-radius-small": theme.appearance.radii.small,
    "--brand-radius-medium": theme.appearance.radii.medium,
    "--brand-radius-large": theme.appearance.radii.large,
    "--brand-space-small": theme.appearance.spacing.small,
    "--brand-space-medium": theme.appearance.spacing.medium,
    "--brand-space-large": theme.appearance.spacing.large,
    "--brand-font-family": theme.appearance.fontFamily,
    "--brand-display-weight": theme.appearance.displayWeight,
    "--brand-body-weight": theme.appearance.bodyWeight,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.appearance.fontFamily,
  };

  if (theme.assets.backgroundImageUrl) {
    style.backgroundImage = `linear-gradient(${theme.colors.background}99, ${theme.colors.background}99), url("${theme.assets.backgroundImageUrl}")`;
  } else if (theme.design.stylePreset === "NEON") {
    style.backgroundImage = `radial-gradient(circle at 20% 20%, ${theme.colors.secondary} 0, ${theme.colors.secondary}22 24%, transparent 42%), radial-gradient(circle at 80% 10%, ${theme.colors.primary}66 0, ${theme.colors.primary}22 22%, transparent 38%), linear-gradient(135deg, #1a0033, ${theme.colors.background} 45%, #001a3a)`;
  } else if (theme.design.stylePreset === "CORPORATE") {
    style.backgroundImage = `linear-gradient(120deg, ${theme.colors.background}, ${theme.colors.surfaceStrong})`;
  } else {
    style.backgroundImage = `radial-gradient(circle at 12% 15%, ${theme.colors.accent}33 0 7%, transparent 8%), radial-gradient(circle at 88% 10%, ${theme.colors.secondary}22 0 10%, transparent 11%), linear-gradient(145deg, ${theme.colors.background}, ${theme.colors.surfaceStrong})`;
  }

  return style;
}
